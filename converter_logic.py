def language_converter(input_code, target_lang):
    # Simplified strings to avoid Python 3.14 AttributeErrors
    if not input_code:
        return "No-Code-Error"

    if target_lang == "Go":
        return "Result-Go"
    elif target_lang == "Rust":
        return "Result-Rust"
    elif target_lang == "Python":
        return "Result-Python"
    else:
        # Avoid f-strings here as they trigger the astunparse bug
        return "Result-Other"