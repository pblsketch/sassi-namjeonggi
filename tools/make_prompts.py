# -*- coding: utf-8 -*-
"""에셋 생성 프롬프트(tools/prompts/*.txt)와 manifest(tools/manifest.tsv)를 만든다.

    python tools/make_prompts.py

프롬프트는 영어(ASCII)만 쓴다. gen.ps1이 명령문에 그대로 넣어 넘기기 때문이다.
manifest 열: 이름, 크기, 참조 이미지, 참조 방식(same|style|scene)
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDIR = os.path.join(ROOT, "tools", "prompts")
os.makedirs(PDIR, exist_ok=True)

LINEUP = "design/style-samples/style_a_minhwa.png"
REF = {
    "sassi": "design/ref/ref_sassi.png",
    "yeonsu": "design/ref/ref_yeonsu.png",
    "gyo": "design/ref/ref_gyo.png",
    "dong": "design/ref/ref_dongcheong.png",
}

STYLE = (
    "Art style: 19th-century Joseon Korean folk painting (minhwa) in the manner of classical-novel illustration "
    "folding screens (such as the Guunmong screens): flat opaque mineral pigments, fine even black ink outlines, "
    "simple decorative patterns on clothes, slightly naive and charming proportions, painted on aged yellowish hanji "
    "paper with visible fibers. Absolutely no text, no letters, no calligraphy, no seals, no signatures, no captions, "
    "no frames or borders."
)
MING = (
    " The story is set in Ming-dynasty China (16th century), so every story character wears MING DYNASTY Chinese Han "
    "clothing, never Korean hanbok."
)

PORTRAIT = (
    "Bust portrait (head and upper chest) of a single character for a story game character card. The figure is "
    "centered, facing slightly toward the viewer, and fills most of the square. Plain aged hanji paper background with "
    "nothing else on it.\n\nCharacter: "
)

SCENE = (
    "Wide illustration of one scene from a classical novel, for a mobile story game. Clear readable composition, "
    "figures large enough to recognize, calm areas of background around the figures.\n\nScene: "
)

P = {}      # name -> prompt
M = []      # (name, size, ref, mode)


def portrait(name, desc, ref=LINEUP, mode="style", ming=True):
    P[name] = PORTRAIT + desc + "\n\n" + STYLE + (MING if ming else "")
    M.append((name, "1024x1024", ref, mode))


def scene(name, desc, size="1536x1024", ref=LINEUP, mode="scene", ming=True):
    P[name] = SCENE + desc + "\n\n" + STYLE + (MING if ming else "")
    M.append((name, size, ref, mode))


# ---------- 주요 인물 (참조 이미지의 인물 그대로, 표정만 다르게) ----------
SASSI = ("Lady Sa (Sa Jeong-ok), the virtuous principal wife, early 20s, hair in a neat high bun with a few modest jade "
         "pins, small jade earrings, muted indigo-blue beizi coat with a pale celadon inner collar.")
portrait("pt_sassi_calm", SASSI + " Expression: calm and dignified, gentle clear eyes, a faint kind smile.",
         REF["sassi"], "same")
portrait("pt_sassi_sad", "Lady Sa (Sa Jeong-ok), the same woman as in the reference, now expelled from her home: hair in a "
         "plain low bun with no ornaments, wearing plain undyed off-white mourning-style robes. Expression: sorrowful, eyes "
         "lowered, holding back tears, still dignified.", REF["sassi"], "same")

YEONSU = ("Yu Yeon-su, a young Hanlin academician in his early 20s, handsome, black Ming official gauze hat with two side "
          "wings, dark green round-collar official robe with a PLAIN chest and NO rank badge.")
portrait("pt_yeonsu_calm", YEONSU + " Expression: gentle, kind, slightly naive and easily swayed.", REF["yeonsu"], "same")
portrait("pt_yeonsu_angry", YEONSU + " Expression: suspicious and angry, eyebrows drawn together, lips pressed tight, "
         "glaring to the side.", REF["yeonsu"], "same")
portrait("pt_yeonsu_regret", "Yu Yeon-su, the same man as in the reference, now a haggard exile: simple black scholar cap and "
         "a plain dark grey robe, thinner cheeks. Expression: deep remorse, head slightly bowed, eyes wet with regret.",
         REF["yeonsu"], "same")

GYO = ("Lady Gyo (Gyo Chae-ran), the young concubine about 17, very beautiful, elaborate hairstyle with many gold hairpins "
       "and a red peony flower, bright peach-pink and crimson layered Ming dress with gold trim, holding a round silk fan.")
portrait("pt_gyo_smile", GYO + " Expression: sweet, charming, innocent-looking smile.", REF["gyo"], "same")
portrait("pt_gyo_scheme", GYO + " Expression: cold scheming sidelong glance, half of her face hidden behind the round fan, "
         "a thin sly smile.", REF["gyo"], "same")

DONG = ("Dong Cheong, the household secretary, late 20s, thin face, narrow eyes, thin moustache and small goatee, square "
        "black scholar cap, plain grey-brown scholar robe, holding a calligraphy brush.")
portrait("pt_dong_polite", DONG + " Expression: polite, obliging, slightly fake smile.", REF["dong"], "same")
portrait("pt_dong_scheme", DONG + " Expression: sinister and cunning, eyes narrowed, hand raised beside his mouth as if "
         "whispering a plot.", REF["dong"], "same")

# ---------- 다른 인물 (화풍만 참조) ----------
portrait("pt_naengjin", "Naeng Jin, Dong Cheong's crony, about 30, a burly rough man with stubble and a crooked grin, dark "
         "indigo-black short travelling robe with a sash, black cloth headwrap.")
portrait("pt_napmae", "Napmae, Lady Gyo's loyal maidservant, a young woman about 18 with sharp sly eyes, hair in two simple "
         "buns tied with ribbons, plain ochre-orange maid's jacket and skirt.")
portrait("pt_seolmae", "Seolmae, Lady Sa's maidservant, a young woman about 17 with timid, nervous eyes, hair in a single low "
         "braided bun, plain pale lavender maid's jacket and skirt.")
portrait("pt_chunbang", "Chunbang, Lady Sa's loyal maidservant, a young woman about 18 with an honest, earnest face, hair in "
         "a simple bun with a plain wooden pin, plain light mint-green maid's jacket and skirt.")
portrait("pt_dubuin", "Lady Du, a widowed noblewoman about 50, the paternal aunt of the family, dignified, wise and strict, "
         "grey-streaked hair in a plain bun with a single silver pin, dark brown and ash-grey plain widow's robes.")
portrait("pt_yusosa", "Grand Tutor Yu, an elderly scholar-official about 60, kind and wise, long white beard, black Ming "
         "official gauze hat with side wings, deep crimson round-collar official robe with a PLAIN chest and NO rank badge.")
portrait("pt_isipnang", "Yi Sip-nang, a sorceress and shaman woman about 40 with mysterious narrow eyes, dark purple robe "
         "hung with small blank paper talismans, holding a small brass ritual bell.")
portrait("pt_ina", "In-a, a boy of about 7, bright clever eyes, hair tied in two small tufts, pale sky-blue child's robe.")
portrait("pt_jangju", "Baby Jang-ju, a chubby healthy infant peacefully asleep, wrapped in a red swaddling cloth "
         "embroidered with small gold patterns.")
portrait("pt_nun", "The Buddhist nun, a woman about 50 with a shaved head, serene and compassionate face, grey Buddhist robe "
         "with a brown kasaya over one shoulder, holding wooden prayer beads.")
portrait("pt_imssi", "Lady Im, a kind young woman about 20 with a gentle modest face, simple hair bun with a small white "
         "flower, plain pale peach-white robe.")
portrait("pt_eomsung", "Grand Secretary Eom, a powerful elderly Ming minister about 65 with a greedy, cunning face, thin long "
         "white beard, black official gauze hat with side wings, crimson official robe with an embroidered crane rank badge.")
portrait("pt_consorts", "Ehuang and Nuying, the two legendary consorts of the ancient sage Emperor Shun, shown as two divine "
         "queens side by side in one picture: ancient ceremonial robes in deep blue and gold, tall crowns with hanging "
         "jade beads, calm, solemn and benevolent faces, soft stylized clouds behind them.")
portrait("pt_oldwoman", "A mysterious kind old woman from Dongting Lake, white hair in a small bun, plain white robe, holding "
         "a small white porcelain water bottle in both hands.")
portrait("pt_owner", "A friendly middle-aged Korean bookshop owner of late 18th-century Seoul. This man is NOT from the story: "
         "he is a Joseon Korean and wears Korean hanbok (white jeogori and a grey-blue durumagi coat) and a black horsehair "
         "gat hat, small round spectacles, holding a stack of thread-bound books, warm humorous smile.", ming=False)

# ---------- 장면 삽화 ----------
scene("sc_bookshop", "Interior of a small late-18th-century Joseon Korean book-lending shop in Seoul: low wooden shelves "
      "stacked with thread-bound books with yellow covers, a low writing desk with a brush, an inkstone and an open old "
      "manuscript whose pages are stained with spilled ink and rain water, a paper window with soft daylight, a cat "
      "sleeping on a cushion. No people. This room is in Joseon Korea, so the architecture is Korean.", ming=False)
scene("sc_gwaneum", "Inside a refined Ming-dynasty Chinese mansion room: a young noble lady in an indigo-blue robe kneels at a "
      "low desk and writes with a brush on the blank margin of a large hanging scroll painting of the white-robed Guanyin "
      "bodhisattva; a Buddhist nun in grey robes waits respectfully beside her; a vase of flowers.")
scene("sc_wedding", "A Ming-dynasty mansion hall on a wedding day: an elderly scholar-official in a crimson robe with a long "
      "white beard presents a round bronze mirror and a pair of jade rings on a red lacquer tray to a young bride in an "
      "indigo-blue robe, who bows respectfully; the young groom in dark green stands beside her; red candles and flowers.")
scene("sc_pavilion", "A garden pavilion beside a lotus pond in a Ming-dynasty mansion in spring: a young woman in pink and "
      "crimson with gold hairpins plays a guqin zither on a low table and sings; the lady in indigo-blue stands at the "
      "pavilion steps, gently raising one hand as if giving calm advice; a maid in ochre-orange stands behind the singer.")
scene("sc_curse", "Night in a Ming-dynasty mansion lit by an oil lamp: a maid in ochre-orange kneels by a lifted floor board "
      "and pulls out a small cloth bundle with a folded blank paper charm; a young woman in pink holds a crying baby wrapped "
      "in red; the young official in dark green stands looking shocked and troubled.")
scene("sc_tavern", "A roadside inn in Shandong province in the Ming dynasty: at a wooden table a burly rough man in "
      "indigo-black travelling clothes shows a small jade ring tied with a red silk knot to the young official in dark "
      "green, who stares at it in shock; wine cups and a paper lantern; other travellers in the background.")
scene("sc_expulsion", "Dusk at the main gate of a large Ming-dynasty mansion: the lady, now in plain off-white robes, walks "
      "out through the gate with an elderly nurse and a young maid, looking back sorrowfully at a small boy held by a "
      "servant inside the courtyard; the young official in dark green stands in the courtyard with his back turned.")
scene("sc_gravehut", "A small thatched hut at the foot of a quiet hill with two family grave mounds and pine trees in early "
      "winter; through the open door a lady in plain off-white robes works at a weaving loom; an elderly nurse carries "
      "water.")
scene("sc_boat", "A small merchant boat on a vast misty river flowing south between reeds and distant mountains; under the "
      "boat's straw awning sit a lady in plain off-white robes, an elderly nurse and a young maid; a boatman poles the "
      "boat.")
scene("sc_dream_shrine", "A dream vision: a magnificent ancient shrine palace floating among clouds; two regal queens in "
      "ancient ceremonial robes and crowns with hanging jade beads sit on thrones and kindly receive a kneeling lady in "
      "plain off-white robes; several noblewomen in ancient dress stand in rows; the edges fade into mist and bamboo.")
scene("sc_nun_boat", "Night on Dongting Lake under a bright full moon: a Buddhist nun in grey robes and a young novice row a "
      "small boat toward the shore, where a lady in plain off-white robes and an elderly nurse stand beside a bamboo grove "
      "and an old lakeside shrine; the small island mountain Junshan rises in the distance.")
scene("sc_exile", "A humble exile's cottage in a hot, humid southern village with banana plants: a haggard man in a plain "
      "dark grey robe lies ill on a straw mat; at the doorway a kind old woman in white robes sets down a small white "
      "porcelain water bottle; in the yard fresh spring water bubbles up from the ground.")
scene("sc_confession", "A roadside tavern in southern China: a young maid in plain pale lavender kneels on the floor, weeping "
      "and confessing, before a man in plain travelling clothes and a simple black scholar cap who listens in shock.")
scene("sc_rescue", "Night on a wide river at a place of white duckweed: a boat with a Buddhist nun in grey robes and a lady in "
      "plain off-white robes reaches the riverbank, where they help a desperate man in plain travelling clothes climb "
      "aboard, while armed pursuers with torches run along the bank in the distance.")
scene("sc_judgment", "A grand hall of a Ming-dynasty official residence: a stern mature official in dark official robes sits "
      "at a raised table; below him a woman in faded, worn pink robes kneels on the floor with her head bowed; servants "
      "stand at both sides; the lady in indigo-blue sits apart behind a painted folding screen.")
scene("sc_reunion", "A warm courtyard of a Ming-dynasty mansion in spring with plum blossoms: the lady in rich indigo-blue "
      "robes embraces a boy of about 7 in a pale sky-blue robe; a young woman in pale peach-white and an elderly nurse "
      "smile beside them.")

# ---------- 지도·표지·질감 ----------
scene("map_south", "An illustrated old map, drawn like a Korean folk-painting map, of Ming China from the capital region in "
      "the north down to Dongting Lake in the south: winding great rivers, the wide Dongting Lake with the small island "
      "mountain Junshan, a lakeside tower on the shore, stylized mountains, waves and tiny boats. Leave plenty of calm "
      "space. No text, no labels, no compass letters.", size="1024x1536", ref=LINEUP, mode="style")
scene("title_art", "Title key art: an old thread-bound manuscript lies open on a low wooden desk, its pages blotted with "
      "spreading black ink; out of the ink rise faint painted figures of a lady in indigo-blue, a young official in dark "
      "green, a woman in pink and crimson with a round fan, and a scheming man in grey-brown; plum blossoms and bamboo at "
      "the sides; keep the upper third empty misty paper for a title.", size="1024x1536")
P["paper"] = ("Seamless flat texture of aged yellowish Korean hanji mulberry paper seen straight on, even lighting, visible "
              "soft fibers and faint mottling, no objects, no text, no shadows, no borders. The texture must tile "
              "seamlessly.")
M.append(("paper", "1024x1024", "", ""))

for name, text in P.items():
    assert all(ord(ch) < 128 for ch in text), name
    with open(os.path.join(PDIR, name + ".txt"), "w", encoding="utf-8") as f:
        f.write(text)

with open(os.path.join(ROOT, "tools", "manifest.tsv"), "w", encoding="utf-8") as f:
    f.write("# name\tsize\tref\tmode\n")
    for row in M:
        f.write("\t".join(row) + "\n")
print(len(P), "prompts")
