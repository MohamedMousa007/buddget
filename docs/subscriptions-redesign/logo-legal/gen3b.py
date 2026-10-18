import json
from collections import Counter
base = "/private/tmp/claude-501/-Users-mohamedmousa-Desktop-Budget-Manager-buddget/45fef101-0972-4c2b-9aae-c7c121cd0988/scratchpad/logo-legal/"
a = json.load(open(base + "slice3.json"))
D = "2026-10-18"
# id: (rating, confidence, urls, paraphrase, notes)
u = {
 "nintendo_switch_online": ("RED", "high", ["https://www.nintendo.com/en-gb/Legal-information/Copyright/Copyright-625949.html"],
   "Nintendo's copyright page (read directly) bars third-party use of its logos/trademarks with non-Nintendo products or services or where customers could be confused, and says it generally declines permission requests.",
   "Known aggressive enforcer. Plain-text name only."),
 "udemy": ("RED", "medium", None,
   "Udemy trademark guidelines (search summary of official support page; direct fetch returned 403) require Udemy written permission for its logos.",
   "Primary page still unreadable (HTTP 403); not confirmed first-hand."),
 "coursera": ("YELLOW", "low", ["https://www.coursera.org/about/press"],
   "Coursera press page (read) has no usage rules; points to a press kit and press@coursera.org.",
   "No explicit permission or prohibition found."),
 "anghami": ("YELLOW", "low", ["https://docs.sdk.anghami.com/license"],
   "No public brand guidelines found. SDK licence says Anghami is a trademark and marks must follow guidelines supplied under a developer agreement.",
   "Unofficial logo aggregators are not a licence."),
 "deezer": ("YELLOW", "low", ["https://brandkit.pro/brand/deezer"],
   "Official guidelines (reportedly deezerbrand.com) not retrieved; only aggregator pages found, one marking the logo editorial-use-only.",
   "Check deezerbrand.com manually."),
 "audible": ("YELLOW", "low", ["https://advertising.amazon.com/resources/ad-policy/brand-usage"],
   "No Audible-specific policy found. Amazon's ad policy says Amazon marks beyond the 'available at Amazon' logo need written approval; its trademark guidelines target licensees and bar altering logos or implying endorsement.",
   "Amazon is a heavy brand enforcer; policy is for advertising/licensees, not identification use."),
 "kindle_unlimited": ("YELLOW", "low", ["https://advertising.amazon.com/resources/ad-policy/brand-usage"],
   "No Kindle-specific logo policy found. Amazon's ad policy lists 'Kindle' among terms third parties may not use in ads without approval.",
   "Same Amazon caveats as Audible."),
 "storytel": ("YELLOW", "low", ["https://press.storytel.com/about-us"],
   "No official logo usage guide found; press room exists at press.storytel.com (not inspected for terms).", ""),
 "youtube_music": ("YELLOW", "medium", ["https://brand.youtube", "https://developers.google.com/youtube/branding"],
   "YouTube brand hub (via search summary) requires approval via a form for some contexts, forbids altering the logo, and says the logo should not be used alone without approval; API branding rules forbid implying endorsement.",
   "YouTube Music icon not specifically covered. Google 'Third Party Use' terms require consent for uncovered uses."),
 "scribd": ("YELLOW", "low", [], "No official Scribd/Everand brand guidelines found.", "Owner's brand pages not located."),
 "ea_play": ("YELLOW", "low", ["https://www.ea.com/tr-tr/compete/guidelines"],
   "No EA Play logo policy found; EA's tournament guidelines forbid implying EA endorsement and note EA has not cleared third-party content.", ""),
 "ubisoft_plus": ("YELLOW", "low", ["https://www.ubisoft.com/legal/documents/videopolicy"],
   "No Ubisoft logo/Ubisoft+ policy found; video policy covers game footage only.", ""),
 "google_play_pass": ("RED", "low", ["https://developer.android.com/games/pgs/branding", "https://developer.android.com/distribute/tools/promote/brand"],
   "Google pages (via search summary) say uses beyond the guidelines need prior written consent, Google Play-mark creatives need brand-team approval, and Google logos must not be used in app icons.",
   "Guidelines target developers promoting their apps; Google Brand Resource Center not read. Could soften to YELLOW on review. Text name acceptable."),
 "roblox_premium": ("RED", "medium", ["https://en.help.roblox.com/hc/articles/115001708126"],
   "Roblox usage guidelines (via search summary) say the logo is not allowed except via the official badge, limited to select partners, and unsolicited requests are not granted.", ""),
 "fortnite_crew": ("YELLOW", "low", ["https://legal.epicgames.com/fortnite/eula/uefn", "https://legal.epicgames.com/epicgames/intellectual-property-faq"],
   "Epic bars creators from using Fortnite/Epic logos in experiences or their promotion; says third-party logos generally need the rightsholder's permission. No rule for trackers.",
   "Creator-programme terms apply only by analogy; leaning RED."),
 "skillshare": ("YELLOW", "low", ["https://conductatlas.com/platform/skillshare/skillshare-terms-of-service/provision/CA-P-034037/no-right-to-use-skillshare-trademarks-or-brand/"],
   "ToS reportedly grants no right to use Skillshare trademarks/logos (secondary summary only).", "Primary ToS not read."),
 "masterclass": ("YELLOW", "low", [], "No official guidelines found; affiliate material says supplied creatives must be used as-is (secondary).", ""),
 "telegram_premium": ("YELLOW", "low", [], "No official Telegram brand guidelines found; ToS page read contains none.", "Check telegram.org/tos/brand manually."),
 "x_premium": ("YELLOW", "low", ["https://docs.x.com/ja/developer-terms/display-requirements"],
   "Only developer display requirements found (X logo shown with X content); no general third-party logo policy; brand toolkit page returned 402.", ""),
 "tinder": ("YELLOW", "low", [], "No official brand/press guidelines found.", "Match Group is an active IP enforcer; flame is a distinctive mark."),
 "bumble": ("YELLOW", "low", [], "No official brand/press guidelines found.", ""),
}
for x in a:
    if x["id"] in u:
        r, c, urls, p, n = u[x["id"]]
        x["rating"] = r; x["confidence"] = c; x["paraphrase"] = p; x["notes"] = n
        if urls is not None: x["policy_urls"] = urls
        x["checked_at"] = D
        x["recommendation"] = "USE_INITIALS"
        x["conditions"] = []
json.dump(a, open(base + "slice3.json", "w"), indent=1)
with open(base + "slice3.md", "w") as f:
    f.write("# Logo-use risk, slice 3 (research/risk assessment, NOT legal advice). Read 2026-10-17/18.\n\nNo GREEN found. Several rows rest on search summaries, not first-hand page reads (confidence column).\n\n| id | rating | rec | confidence |\n|---|---|---|---|\n")
    for x in a:
        f.write(f"| {x['id']} | {x['rating']} | {x['recommendation']} | {x['confidence']} |\n")
    f.write("\n## Reasons\n")
    for x in a:
        f.write(f"- **{x['name']}** ({x['rating']}): {x['paraphrase']} {x['notes']}\n")
print(Counter(x['rating'] for x in a), [x['id'] for x in a if x['rating'] == 'RED'])
