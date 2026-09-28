#!/usr/bin/env python3
"""
App de escritorio para asociar albaranes a un PDF de solicitudes.

Flujo:
 1. Se abre el PDF de "solicitudes" y se extraen los números de albarán,
    en el orden en que aparecen.
 2. El usuario puede revisar/editar esa lista a mano antes de continuar.
 3. Se busca cada número entre los PDFs de una carpeta local (por nombre
    de archivo, y opcionalmente dentro del contenido del PDF).
 4. Se genera un PDF nuevo, con los albaranes encontrados en ese mismo
    orden. Donde no se encuentra un albarán, se inserta una hoja en blanco.
"""

import os
import re
import queue
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
from pathlib import Path

import pdfplumber
from pypdf import PdfReader, PdfWriter

DEFAULT_PATTERN = (
    r"(?:albar[aá]n(?:es)?|alb\.?)\s*(?:n[ºo°\.]?\s*)?:?\s*"
    r"([A-Za-z]?\d[\d\-/\.]{2,})"
)
FALLBACK_PATTERN = r"\b\d{4,12}\b"

A4_WIDTH, A4_HEIGHT = 595, 842


def normalize(token: str) -> str:
    """Normaliza un número de albarán para comparar (quita separadores y ceros a la izquierda)."""
    token = token.strip().upper()
    digits_only = re.sub(r"[^A-Z0-9]", "", token)
    stripped = digits_only.lstrip("0")
    return stripped or digits_only


def extract_albaran_numbers(pdf_path: str, pattern: str, log) -> list[str]:
    numbers = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            found = re.findall(pattern, text, flags=re.IGNORECASE)
            if found:
                numbers.extend(found)
            log(f"  Página {i + 1}: {len(found)} coincidencia(s)")

    if not numbers:
        log("  No se encontraron coincidencias con el patrón principal, probando patrón de respaldo...")
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                numbers.extend(re.findall(FALLBACK_PATTERN, text))

    # Elimina duplicados consecutivos (cabeceras/pies repetidos), conserva orden.
    deduped = []
    for n in numbers:
        if not deduped or normalize(deduped[-1]) != normalize(n):
            deduped.append(n)
    return deduped


def index_albaranes_folder(folder: str, log) -> dict:
    """Devuelve {numero_normalizado: ruta_archivo} a partir de los nombres de archivo."""
    index = {}
    token_re = re.compile(r"[A-Za-z]?\d[\d\-/\.]{2,}")
    count = 0
    for path in Path(folder).rglob("*"):
        if path.suffix.lower() != ".pdf":
            continue
        count += 1
        for token in token_re.findall(path.stem):
            key = normalize(token)
            if key and key not in index:
                index[key] = str(path)
    log(f"Indexados {count} PDF(s) en la carpeta de albaranes.")
    return index


def find_by_content(number: str, folder: str, already_matched: set, log) -> str | None:
    target = normalize(number)
    for path in Path(folder).rglob("*.pdf"):
        spath = str(path)
        if spath in already_matched:
            continue
        try:
            with pdfplumber.open(spath) as pdf:
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    if target in re.sub(r"[^A-Z0-9]", "", text.upper()):
                        return spath
        except Exception as e:
            log(f"  Aviso: no se pudo leer {path.name}: {e}")
    return None


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Asociador de Albaranes")
        self.geometry("820x680")

        self.solicitudes_path = tk.StringVar()
        self.albaranes_folder = tk.StringVar()
        self.output_path = tk.StringVar()
        self.pattern = tk.StringVar(value=DEFAULT_PATTERN)
        self.search_content = tk.BooleanVar(value=False)

        self.log_queue: queue.Queue = queue.Queue()
        self._build_ui()
        self.after(100, self._drain_log_queue)

    def _build_ui(self):
        pad = {"padx": 8, "pady": 4}

        frm_top = ttk.Frame(self)
        frm_top.pack(fill="x", **pad)

        self._path_row(frm_top, "PDF de solicitudes:", self.solicitudes_path, self._pick_solicitudes)
        self._path_row(frm_top, "Carpeta de albaranes:", self.albaranes_folder, self._pick_folder)
        self._path_row(frm_top, "PDF de salida:", self.output_path, self._pick_output)

        frm_pattern = ttk.Frame(self)
        frm_pattern.pack(fill="x", **pad)
        ttk.Label(frm_pattern, text="Patrón (regex) para detectar el nº de albarán:").pack(side="left")
        ttk.Entry(frm_pattern, textvariable=self.pattern, width=60).pack(side="left", fill="x", expand=True, padx=6)

        frm_opts = ttk.Frame(self)
        frm_opts.pack(fill="x", **pad)
        ttk.Checkbutton(
            frm_opts,
            text="Si no se encuentra por nombre de archivo, buscar también dentro del contenido de los PDFs (más lento)",
            variable=self.search_content,
        ).pack(side="left")

        frm_btns = ttk.Frame(self)
        frm_btns.pack(fill="x", **pad)
        ttk.Button(frm_btns, text="1) Extraer números de albarán", command=self._on_extract).pack(side="left", padx=4)
        ttk.Button(frm_btns, text="2) Generar PDF", command=self._on_generate).pack(side="left", padx=4)

        ttk.Label(self, text="Números de albarán (uno por línea, en orden — puedes editarlos):").pack(
            anchor="w", padx=8
        )
        self.numbers_text = scrolledtext.ScrolledText(self, height=12)
        self.numbers_text.pack(fill="both", expand=True, padx=8, pady=4)

        ttk.Label(self, text="Registro:").pack(anchor="w", padx=8)
        self.log_text = scrolledtext.ScrolledText(self, height=14, state="disabled")
        self.log_text.pack(fill="both", expand=True, padx=8, pady=4)

    def _path_row(self, parent, label, var, command):
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=2)
        ttk.Label(row, text=label, width=20).pack(side="left")
        ttk.Entry(row, textvariable=var).pack(side="left", fill="x", expand=True, padx=6)
        ttk.Button(row, text="Elegir...", command=command).pack(side="left")

    def _pick_solicitudes(self):
        path = filedialog.askopenfilename(filetypes=[("PDF", "*.pdf")])
        if path:
            self.solicitudes_path.set(path)
            if not self.output_path.get():
                base = Path(path).with_name(Path(path).stem + "_albaranes.pdf")
                self.output_path.set(str(base))

    def _pick_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.albaranes_folder.set(folder)

    def _pick_output(self):
        path = filedialog.asksaveasfilename(defaultextension=".pdf", filetypes=[("PDF", "*.pdf")])
        if path:
            self.output_path.set(path)

    def log(self, msg: str):
        self.log_queue.put(msg)

    def _drain_log_queue(self):
        while not self.log_queue.empty():
            msg = self.log_queue.get_nowait()
            self.log_text.configure(state="normal")
            self.log_text.insert("end", msg + "\n")
            self.log_text.see("end")
            self.log_text.configure(state="disabled")
        self.after(100, self._drain_log_queue)

    def _on_extract(self):
        pdf_path = self.solicitudes_path.get().strip()
        if not pdf_path or not os.path.isfile(pdf_path):
            messagebox.showerror("Error", "Selecciona primero un PDF de solicitudes válido.")
            return
        pattern = self.pattern.get().strip() or DEFAULT_PATTERN
        threading.Thread(target=self._extract_worker, args=(pdf_path, pattern), daemon=True).start()

    def _extract_worker(self, pdf_path, pattern):
        self.log(f"Extrayendo números de albarán de: {pdf_path}")
        try:
            numbers = extract_albaran_numbers(pdf_path, pattern, self.log)
        except Exception as e:
            self.log(f"ERROR al extraer: {e}")
            return
        self.log(f"Se han encontrado {len(numbers)} número(s) de albarán.")
        self.numbers_text.delete("1.0", "end")
        self.numbers_text.insert("1.0", "\n".join(numbers))

    def _on_generate(self):
        folder = self.albaranes_folder.get().strip()
        output_path = self.output_path.get().strip()
        if not folder or not os.path.isdir(folder):
            messagebox.showerror("Error", "Selecciona una carpeta de albaranes válida.")
            return
        if not output_path:
            messagebox.showerror("Error", "Indica dónde guardar el PDF de salida.")
            return
        numbers = [
            line.strip()
            for line in self.numbers_text.get("1.0", "end").splitlines()
            if line.strip()
        ]
        if not numbers:
            messagebox.showerror("Error", "No hay números de albarán en la lista. Extráelos primero o escríbelos a mano.")
            return
        threading.Thread(
            target=self._generate_worker, args=(numbers, folder, output_path), daemon=True
        ).start()

    def _generate_worker(self, numbers, folder, output_path):
        search_content = self.search_content.get()
        self.log(f"Indexando carpeta de albaranes: {folder}")
        index = index_albaranes_folder(folder, self.log)

        writer = PdfWriter()
        matched_files: set = set()
        found_count = 0
        missing = []
        last_size = (A4_WIDTH, A4_HEIGHT)

        for i, raw_number in enumerate(numbers, start=1):
            key = normalize(raw_number)
            file_path = index.get(key)

            if not file_path and search_content:
                self.log(f"[{i}/{len(numbers)}] '{raw_number}' no está en ningún nombre de archivo, buscando en el contenido...")
                file_path = find_by_content(raw_number, folder, matched_files, self.log)

            if file_path:
                self.log(f"[{i}/{len(numbers)}] '{raw_number}' -> {Path(file_path).name}")
                try:
                    reader = PdfReader(file_path)
                    for page in reader.pages:
                        writer.add_page(page)
                        last_size = (float(page.mediabox.width), float(page.mediabox.height))
                    matched_files.add(file_path)
                    found_count += 1
                except Exception as e:
                    self.log(f"  ERROR al leer {file_path}: {e} -> se inserta hoja en blanco")
                    writer.add_blank_page(width=last_size[0], height=last_size[1])
                    missing.append(raw_number)
            else:
                self.log(f"[{i}/{len(numbers)}] '{raw_number}' -> NO ENCONTRADO, se inserta hoja en blanco")
                writer.add_blank_page(width=last_size[0], height=last_size[1])
                missing.append(raw_number)

        with open(output_path, "wb") as f:
            writer.write(f)

        self.log("")
        self.log(f"Terminado. PDF generado en: {output_path}")
        self.log(f"Encontrados: {found_count} / {len(numbers)}")
        if missing:
            self.log("No encontrados: " + ", ".join(missing))
        else:
            self.log("Todos los albaranes se han encontrado.")

        self.after(0, lambda: messagebox.showinfo(
            "Completado",
            f"PDF generado en:\n{output_path}\n\n"
            f"Encontrados: {found_count} / {len(numbers)}\n"
            + (f"No encontrados ({len(missing)}): {', '.join(missing)}" if missing else "Todos encontrados."),
        ))


if __name__ == "__main__":
    App().mainloop()
