import re

def main():
    with open('contracts/ShipEscrowV3_1.py', 'r', encoding='utf-8') as f:
        contract_code = f.read()

    with open('README.md', 'r', encoding='utf-8') as f:
        readme_code = f.read()

    # Extract all UserErrors in contract
    contract_errors = sorted(list(set(re.findall(r'raise gl\.vm\.UserError\("([^"]+)"\)', contract_code))))

    # Extract all error messages in README table
    readme_errors = sorted(list(set(re.findall(r'\|\s*`"([^"]+)"`\s*\|', readme_code))))

    print("=== Contract UserError Strings (relevant to submission/bounty) ===")
    for err in contract_errors:
        print(f"  - {err}")

    print("\n=== README Documented Error Messages ===")
    for err in readme_errors:
        print(f"  - {err}")

    # Check for any README documented error message that is NOT in the contract
    extra_in_readme = [e for e in readme_errors if e not in contract_errors]
    print("\n=== Documented Error Strings NOT in Contract ===")
    if not extra_in_readme:
        print("  None! All documented error strings exist in the contract.")
    else:
        for e in extra_in_readme:
            print(f"  MISMATCH: {e}")

if __name__ == '__main__':
    main()
