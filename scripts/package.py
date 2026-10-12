"""Package exactly the installable extension; zip root contains manifest.json."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
extension = root / "extension"
version = json.loads((extension / "manifest.json").read_text(encoding="utf-8"))["version"]
output = root / "dist" / f"ai-wide-reader-v{version}.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for file in sorted(extension.rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(extension))
print(output)
