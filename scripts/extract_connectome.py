"""Reproduce the bundled FlyWire v630 induced subgraph. Standard library only.

No generated/synthetic synapses. Root IDs stay strings to avoid JS precision loss.
Inputs and motor readouts are deliberately artificial fish adapters, not validated
fly sensorimotor mappings. Source data: CC BY-NC 4.0; this script: MIT.
"""
import argparse
import collections
import csv
import gzip
import hashlib
import json
import pathlib
import urllib.request

SOURCE_COMMIT = "ee4944c03429edf857a6b10bcf98bea7dcef35b8"
BASE = f"https://raw.githubusercontent.com/murthylab/flywire-network-analysis/{SOURCE_COMMIT}/v630_data/"
parser = argparse.ArgumentParser()
parser.add_argument("--cache", type=pathlib.Path, default=pathlib.Path("../../work/flywire"))
args = parser.parse_args()
args.cache.mkdir(parents=True, exist_ok=True)
hashes = {}
tables = {}
for name in ["classification", "neurons", "connections"]:
    path = args.cache / f"{name}.csv.gz"
    if not path.exists():
        urllib.request.urlretrieve(BASE + path.name, path)
    hashes[path.name] = hashlib.sha256(path.read_bytes()).hexdigest()
    if name != "connections":
        tables[name] = list(csv.DictReader(gzip.open(path, "rt")))

meta = {r["root_id"]: r for r in tables["classification"]}
nt = {r["root_id"]: r["nt_type"] for r in tables["neurons"]}
candidate = {i for i, r in meta.items() if r["class"] == "CX" or r["cell_type"] in ("DNa01", "DNa02")}
edges = collections.Counter()
strength = collections.Counter()
with gzip.open(args.cache / "connections.csv.gz", "rt") as stream:
    for r in csv.DictReader(stream):
        a, b = r["pre_root_id"], r["post_root_id"]
        if a in candidate and b in candidate and a != b:
            count = int(r["syn_count"])
            edges[a, b] += count
            strength[a] += count
            strength[b] += count

def priority(root):
    r = meta[root]
    t = r["hemibrain_type"]
    core = t in ("EPG", "PEG", "PEN_a(PEN1)", "PEN_b(PEN2)", "PFL3", "PFL2", "Delta7") or r["cell_type"] in ("DNa01", "DNa02")
    return (not core, -strength[root], root)

roots = sorted(candidate, key=priority)[:768]
lookup = {root: i for i, root in enumerate(roots)}
neurons = []
for i, root in enumerate(roots):
    r = meta[root]
    neurons.append({"id": root, "type": r["cell_type"] or r["hemibrain_type"] or "CX", "side": r["side"], "nt": nt.get(root, ""), "adapterGroup": i % 8})
connections = [[lookup[a], lookup[b], count] for (a, b), count in sorted(edges.items()) if a in lookup and b in lookup and count >= 5]
data = {
    "version": "FlyWire FAFB v630",
    "license": "CC BY-NC 4.0",
    "source": "https://github.com/murthylab/flywire-network-analysis",
    "sourceCommit": SOURCE_COMMIT,
    "sourceSha256": hashes,
    "selection": "768 CX / DNa01 / DNa02 neurons; core compass and PFL types first, then descending total internal synapse strength; induced directed edges >=5 summed synapses, no self edges",
    "limitations": "Artificial sensory projection and motor readout. Truncated circuit, normalized synaptic weights, simplified neurotransmitter signs and LIF dynamics. Not a biologically validated fish or whole-fly brain simulation.",
    "neurons": neurons,
    "edges": connections,
}
dest = pathlib.Path(__file__).resolve().parents[1] / "public/data/connectome.json"
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Extracted {len(neurons)} neurons, {len(connections)} edges ({dest.stat().st_size:,} bytes)")
