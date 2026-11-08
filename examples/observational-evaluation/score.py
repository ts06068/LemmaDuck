"""Independent predeclared rubric: methodological checks, not expert utility."""
import json, sys
request=json.load(open(sys.argv[1]))
a=request.get("candidate",{}).get("answer",{}); truth=request["truth"]
if not isinstance(a,dict) or not isinstance(a.get("issues"),list) or not all(isinstance(x,str) for x in a["issues"]) or not isinstance(a.get("rationale"),str) or not a["rationale"].strip():
 result={"valid":False,"metrics":{},"reason":"Malformed visible answer"}
else:
 predicted=set(a["issues"])-{"none"}; expected=set(truth["issues"])
 correct=len(predicted & expected)
 f1=2*correct/(len(predicted)+len(expected)) if predicted or expected else 1.0
 recall=correct/len(expected) if expected else float(not predicted)
 result={"valid":True,"metrics":{"issue_f1":f1,"critical_recall":recall,"claim_restraint":float(a.get("supported_claim")==truth["supported_claim"]),"next_check":float(a.get("next_check")==truth["next_check"])},"reason":"Frozen owner-authored methodological rubric, independent of model and condition; no expert importance rating"}
json.dump(result,open(sys.argv[2],"w"))
