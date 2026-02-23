import re
from pyflowchart import Flowchart

def generate_js_fallback(code):
    """
    Creates a simplified linear flowchart for JS/TS/Other logic 
    to prevent syntax errors on your older hardware.
    """
    lines = [line.strip() for line in code.split('\n') if line.strip() and not line.startswith('/')]
    nodes = ["st=>start: Start JS/TS Analysis"]
    connections = ["st"]

    # Limit to first 8 lines to save RAM on your 14yo laptop
    for i, line in enumerate(lines[:8]):
        # Sanitize text for flowchart.js
        clean_text = line.replace('>', '').replace(':', '-').replace(';', '')
        nodes.append(f"op{i}=>operation: {clean_text}")
        connections.append(f"op{i}")

    nodes.append("e=>end: End")
    connections.append("e")
    
    return "\n".join(nodes) + "\n\n" + "->".join(connections)

def language_converter(input_code, target_lang):
    languages = ["JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "C#", "PHP", "Ruby", "Kotlin"]
    
    if not input_code:
        return "st=>start: Error\ne=>end: No code provided\nst->e"

    # 1. Attempt pyflowchart for Pythonic logic
    try:
        # If the code looks like Python, try to parse it
        fc = Flowchart.from_code(input_code)
        return fc.flowchart()
    except Exception:
        # 2. Trigger Fallback for JS/TS or syntax errors
        return generate_js_fallback(input_code)

# To test in your terminal:
# python -m pyflowchart converter_logic.py