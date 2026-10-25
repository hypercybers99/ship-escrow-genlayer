import ast
import re

def extract_fields():
    with open('contracts/ShipEscrowV3_1.py', 'r', encoding='utf-8') as f:
        code = f.read()

    # Find validator_fn
    pattern = r'def validator_fn\([^)]*\)\s*(?:->\s*[^:]+)?\s*:([\s\S]*?)return True'
    match = re.search(pattern, code)
    if not match:
        print("validator_fn not found")
        return []

    body = match.group(1)
    fields = re.findall(r'leader_packet\.get\("([^"]+)"(?:,\s*[^)]+)?\)', body)
    return fields

if __name__ == '__main__':
    fields = extract_fields()
    print("Compared Fields extracted from validator_fn in contracts/ShipEscrowV3_1.py:")
    for i, field in enumerate(fields, 1):
        print(f"  {i}. {field}")
    print(f"Total compared fields: {len(fields)}")
