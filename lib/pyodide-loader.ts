import type { PyodideInterface } from 'pyodide';

let pyodideInstance: PyodideInterface | null = null;
let loadPromise: Promise<PyodideInterface> | null = null;

const stdoutBuffer: string[] = [];
const stderrBuffer: string[] = [];

// Pyodide signals a stream flush by emitting a NUL ("\0") message (sometimes
// appended to a chunk). Strip those and ignore pure-flush messages.
function capture(msg: string, target: string[]) {
  const clean = msg.replace(/\0+$/g, '');
  if (clean) target.push(clean);
}

export interface PythonResult {
  output: string;
  error: string;
  success: boolean;
}

/**
 * Lazily load and cache a single Pyodide instance.
 * The runtime is only fetched (code-split) the first time it is requested,
 * so it does not bloat the initial bundle.
 */
export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (!loadPromise) {
    loadPromise = (async () => {
      // Dynamic import keeps pyodide out of the main bundle until needed.
      const { loadPyodide } = await import('pyodide');
      const pyodide = await loadPyodide({
        stdout: (msg) => capture(msg, stdoutBuffer),
        stderr: (msg) => capture(msg, stderrBuffer),
      });
      return pyodide;
    })();
  }
  const pyodide = await loadPromise;
  pyodideInstance = pyodide;
  return pyodide;
}

/**
 * Execute a Python snippet and capture its combined stdout/stderr.
 *
 * - stdout from `print()` flows through the load-time `stdout` callback
 *   (buffered here).
 * - A thrown Pyodide error surfaces as a JS exception whose `.message`
 *   contains the Python traceback, which we push to the stderr buffer.
 *
 * NOTE: Only one execution should be in-flight at a time, because the
 * stdout/stderr buffers are shared per Pyodide instance.
 */
export async function executePython(code: string): Promise<PythonResult> {
  const pyodide = await getPyodide();
  stdoutBuffer.length = 0;
  stderrBuffer.length = 0;

  let success = true;
  try {
    await pyodide.runPythonAsync(code);
  } catch (e: any) {
    success = false;
    stderrBuffer.push(e?.message ? String(e.message) : String(e));
  }

  return {
    output: stdoutBuffer.join(''),
    error: stderrBuffer.join(''),
    success,
  };
}

export function isPyodideReady(): boolean {
  return !!pyodideInstance;
}

export function isPyodideLoading(): boolean {
  return !!loadPromise && !pyodideInstance;
}

export function resetPyodide(): void {
  pyodideInstance = null;
  loadPromise = null;
  stdoutBuffer.length = 0;
  stderrBuffer.length = 0;
}

export default {
  getPyodide,
  executePython,
  isPyodideReady,
  isPyodideLoading,
  resetPyodide,
};
