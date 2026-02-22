# converter_logic.py
def language_converter(input_code, target_lang):
    # The list of languages from your UI dropdown
    languages = ["JavaScript", "TypeScript", "Python", "Rust", "Go", "Java", "C#", "PHP", "Ruby", "Kotlin"]
    
    if not input_code:
        return "Error: No code provided"

    # Selection Logic
    if target_lang == "Go":
        return "Transforming to Go syntax..."
    elif target_lang == "Rust":
        return "Applying Rust ownership rules..."
    elif target_lang == "Python":
        return "Converting to Pythonic code..."
    elif target_lang in languages:
        return f"Converting to {target_lang}..."
    else:
        return "Language not supported"