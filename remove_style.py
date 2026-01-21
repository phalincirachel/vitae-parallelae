
try:
    with open("liminal library.html", "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    # Remove lines 20 to 732 (inclusive, 1-based)
    # Indices: 19 to 731 (inclusive, 0-based)
    # We keep 0..18 and 732..end
    
    new_lines = lines[:19] + lines[732:]
    
    with open("liminal library.html", "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print("Successfully removed style block.")
except Exception as e:
    print(f"Error: {e}")
