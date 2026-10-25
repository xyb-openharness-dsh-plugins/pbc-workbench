#!/bin/bash
# PubMed evidence harvesting for PBC workbench
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

EUTILS="https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

q_T1="primary biliary cholangitis diagnosis antimitochondrial antibody alkaline phosphatase"
q_T2="ursodeoxycholic acid dose biochemical response primary biliary cholangitis Paris Barcelona GLOBE UK-PBC"
q_T3="obeticholic acid bezafibrate fibrates primary biliary cholangitis"
q_T4="primary biliary cholangitis cirrhosis surveillance hepatocellular carcinoma screening"
q_T5="primary biliary cholangitis osteoporosis fat-soluble vitamin deficiency"
q_T6="primary biliary cholangitis pruritus fatigue management"
q_T7="primary biliary cholangitis Sjogren syndrome thyroid systemic sclerosis autoimmune comorbidity"
q_T8="primary biliary cholangitis pregnancy fertility"
q_T9="liver transplantation primary biliary cholangitis indication timing"
q_T10="primary biliary cholangitis epidemiology China Asia disease burden"

for i in 1 2 3 4 5 6 7 8 9 10; do
  var="q_T$i"
  q="${!var}"
  enc=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$q")
  echo "=== T$i ==="
  echo "QUERY: $q"
  curl -s --max-time 40 "$EUTILS/esearch.fcgi?db=pubmed&term=$enc&retmode=json&retmax=8" \
    -o "T$i.esearch.json"
  # extract count + idlist
  python3 - "$i" <<'PY'
import json,sys
i=sys.argv[1]
try:
    d=json.load(open(f"T{i}.esearch.json"))
    r=d["esearchresult"]
    print("COUNT:", r.get("count"), "| IDs:", ",".join(r.get("idlist",[])))
    if r.get("warninglist"):
        print("WARN:", r["warninglist"])
    if r.get("errorlist"):
        print("ERR:", r["errorlist"])
except Exception as e:
    print("PARSE_FAIL:", e)
PY
  # fetch summaries
  ids=$(python3 -c "
import json
try:
    d=json.load(open('T$i.esearch.json'))
    print(','.join(d['esearchresult'].get('idlist',[])))
except Exception:
    print('')
")
  if [ -n "$ids" ]; then
    sleep 0.5
    curl -s --max-time 40 "$EUTILS/esummary.fcgi?db=pubmed&id=$ids&retmode=json" -o "T$i.esummary.json"
    echo "SUMMARY_BYTES: $(wc -c < T$i.esummary.json)"
  else
    echo "SUMMARY_BYTES: 0 (no ids)"
  fi
  sleep 0.5
done
echo "ALL DONE"
