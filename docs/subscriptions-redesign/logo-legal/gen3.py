import json
from collections import Counter
D = "2026-10-17"
U = "UNVERIFIED"
unv = "Not researched: tool session limit was hit mid-run. Default to initials until checked."


def r(id, name, rating, rec, cond, urls, para, conf, notes=""):
    return dict(id=id, name=name, rating=rating, recommendation=rec, conditions=cond,
                policy_urls=urls, paraphrase=para, checked_at=D, confidence=conf, notes=notes)


a = [
    r("spotify", "Spotify", "YELLOW", "USE_LOGO_WITH_CONDITIONS",
      ["Unmodified icon only, monochrome (black on light / white on dark) unless on black/white", "Min 21px; clear space = half icon height", "Do not pair with our own branding over artwork; no implied partnership"],
      ["https://developer.spotify.com/documentation/design"],
      "Design guidelines govern partners using Spotify content/metadata (attribution with logo). No clause for a tracker referencing the service. Forbids altering the logo and pairing Spotify with other brands.",
      "medium", "Not a Spotify integration, so guidelines apply only by analogy. Wordmark-as-text safer."),
    r("apple_music", "Apple Music", "RED", "USE_INITIALS", [],
      ["https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html"],
      "Apple says third parties need an express written trademark licence for Apple-owned logos/graphic symbols; only word marks may be used referentially (e.g. 'compatible with') and less prominently than own name.",
      "medium", "Page does not name the Apple Music logo specifically; general rule applied. Plain text name is acceptable."),
    r("apple_arcade", "Apple Arcade", "RED", "USE_INITIALS", [],
      ["https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html"],
      "Same Apple rule: logos need express written licence; text word mark referential use only.",
      "medium", "Same note as Apple Music."),
    r("playstation_plus", "PlayStation Plus", "YELLOW", "USE_INITIALS",
      ["If a logo is wanted: contact Sony Official Licensing Program"],
      ["https://www.playstation.com/en-us/legal/copyright-and-trademark-notice/"],
      "Sony notice lists marks and reserves rights; gives no third-party usage rules; points to an Official Licensing Program page (not read).",
      "low", "Sony is a known IP enforcer; marks are stylised. Conservative fallback."),
    r("xbox_game_pass", "Xbox Game Pass", "RED", "USE_INITIALS", [],
      ["https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks"],
      "Microsoft guidelines say not to use its logos, icons or designs in any manner without permission; word marks may be used to accurately describe a product without implying endorsement.",
      "medium", "xbox.com/en-US/legal/trademarks returned 404. Text name OK."),
    r("nintendo_switch_online", "Nintendo Switch Online", "RED", "USE_INITIALS", [],
      ["https://www.nintendo.com/en-gb/Legal-information/Copyright/Copyright-625949.html"],
      "Per search summary (page itself could not be fetched): Nintendo does not grant permission to use its content and declines trademark requests; use with non-Nintendo products is not allowed.",
      "low", "Nintendo is a notably aggressive enforcer. Page not directly read."),
    r("discord_nitro", "Discord Nitro", "YELLOW", "USE_LOGO_WITH_CONDITIONS",
      ["Unmodified Discord symbol in colour, black or white only", "Only where Discord brand is clear nearby (else full logo)", "Do not imply Discord affiliation; digital use only"],
      ["https://discord.com/branding"],
      "Discord marks need permission for most uses; allowed to state you use Discord without implying affiliation; do not edit/recolour. No tracker-specific clause.",
      "medium", "Weak fit with the 'say you are a Discord user' allowance. Wordmark text safer."),
    r("twitch", "Twitch Turbo / subs", "YELLOW", "USE_INITIALS", [],
      ["https://brand.twitch.com/"],
      "Brand page only offers an official asset download; no stated rules on third-party use or permission found.",
      "low", "Full guidelines not located."),
    r("linkedin_premium", "LinkedIn Premium", "YELLOW", "USE_INITIALS",
      ["If used: official asset only, unmodified, clearly separate from LinkedIn"],
      ["https://brand.linkedin.com/policies"],
      "LinkedIn allows use only as described in its guidelines or with express written permission, official assets only, must not suggest sponsorship; may ask you to stop.",
      "medium", "Close to RED on strictness."),
    r("duolingo", "Duolingo Super", "YELLOW", "USE_INITIALS", [],
      ["https://design.duolingo.com/identity/logos"],
      "Duolingo design site gives logo colour/clear-space/no-recolour rules but nothing on third-party permission; ToS reportedly grants no trademark licence (secondary summary).",
      "low", "Mascot is distinctive; character art riskier than wordmark."),
    r("udemy", "Udemy (courses / Personal Plan)", "RED", "USE_INITIALS", [],
      ["https://support.udemy.com/hc/en-us/articles/8926724282519-Trademark-Guidelines-For-Instructors"],
      "Udemy trademark guidelines (via search summary) say use of its logos requires Udemy written permission.",
      "medium", "Guidelines are aimed at instructors; Udemy press page returned 403."),
    r("snapchat_plus", "Snapchat+", "YELLOW", "USE_INITIALS", [],
      ["https://developers.snap.com/snap-kit/app-review/brand-guidelines", "https://snap.com/en-US/ad-policies"],
      "Snap Kit guidelines name the Ghost logo as something third-party apps must not use as their own branding; ads may not use Snap trademarks outside brand guidelines. No general referential-use rule found.",
      "low", "Context is developer/ad programmes, not identification use; leaning RED if challenged."),
]
ids = [("anghami", "Anghami"), ("deezer", "Deezer"), ("audible", "Audible"), ("storytel", "Storytel"),
       ("kindle_unlimited", "Kindle Unlimited"), ("youtube_music", "YouTube Music Premium"),
       ("scribd", "Scribd / Everand"), ("ea_play", "EA Play"), ("ubisoft_plus", "Ubisoft+"),
       ("google_play_pass", "Google Play Pass"), ("roblox_premium", "Roblox Premium"),
       ("fortnite_crew", "Fortnite Crew"), ("coursera", "Coursera Plus"), ("skillshare", "Skillshare"),
       ("masterclass", "MasterClass"), ("telegram_premium", "Telegram Premium"), ("x_premium", "X Premium"),
       ("tinder", "Tinder"), ("bumble", "Bumble")]
for i, n in ids:
    a.append(r(i, n, U, "USE_INITIALS", [], [], "No policy read.", "none", unv))
base = "/private/tmp/claude-501/-Users-mohamedmousa-Desktop-Budget-Manager-buddget/45fef101-0972-4c2b-9aae-c7c121cd0988/scratchpad/logo-legal/"
json.dump(a, open(base + "slice3.json", "w"), indent=1)
with open(base + "slice3.md", "w") as f:
    f.write("# Logo-use risk, slice 3 (research/risk assessment, not legal advice). Read 2026-10-17.\n\nResearch was cut short by a tool session limit; UNVERIFIED rows were not researched.\n\n| id | rating | rec | confidence |\n|---|---|---|---|\n")
    for x in a:
        f.write(f"| {x['id']} | {x['rating']} | {x['recommendation']} | {x['confidence']} |\n")
    f.write("\n## RED / YELLOW reasons\n")
    for x in a:
        if x['rating'] in ("RED", "YELLOW"):
            f.write(f"- **{x['name']}** ({x['rating']}): {x['paraphrase']} {x['notes']}\n")
print(Counter(x['rating'] for x in a), len(a))
