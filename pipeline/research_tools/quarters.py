import re, sys, html
for sym in sys.argv[1:]:
    s = open(f"raw/{sym}.html").read()
    q = s[s.find('id="quarters"'):]; q = q[:q.find("</table>")]
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", q, re.S)
    print("==", sym)
    for r in rows:
        cells = [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", c))).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
        if cells and (cells[0] == "" or re.match(r"(Sales|Revenue|Operating|OPM|Net Profit|Profit before|Other)", cells[0])):
            print(" | ".join(cells[:1] + cells[-7:]))
