'use strict';
// 인물과 호칭 데이터 (선생님이 고쳐도 되는 파일)
//  - name   : 게임에서 쓰는 대표 이름
//  - side   : 관계도에서 묶는 편 (yu: 유씨 집안, sa: 사씨 쪽, gyo: 교씨 일당, help: 돕는 이, court: 조정)
//  - color  : 인물 대표 색 (그림 속 옷 색과 맞춤)
//  - pt     : 초상 이미지 이름 (assets/pt/<이름>.webp), 표정별
//  - aliases: 호칭. t=호칭, kind=종류, who=누가·언제 쓰는지, tip=헷갈리기 쉬운 점
//  - fate   : 결말 (원작 기준, 새로 쓴 문장)
//  - pos    : 관계도에서의 위치 (가로 0~100, 세로 0~120)
// 이본마다 이름이 다른 인물은 이름 대신 호칭을 대표 이름으로 쓴다(유 소사, 여승, 임씨). 차이는 notes.js의 이본 노트에 있다.
window.PEOPLE = {
  sassi: {
    name: '사씨', full: '사정옥', hanja: '謝貞玉', side: 'sa', color: '#35507f',
    role: '유연수의 정실부인. 사 급사의 딸',
    pt: { calm: 'pt_sassi_calm', sad: 'pt_sassi_sad' },
    aliases: [
      { t: '사씨', kind: '성+씨', who: '서술' },
      { t: '사정옥', kind: '본명', who: '본인의 이름' },
      { t: '사 소저', kind: '신분', who: '혼인하기 전. 소저는 양반집 처녀를 높여 부르는 말', tip: '혼인한 뒤에는 거의 쓰지 않아요.' },
      { t: '부인', kind: '신분', who: '혼인한 뒤 서술과 집안사람들', tip: '혼인한 여성을 높이는 말이라 두 부인·교 부인처럼 다른 사람에게도 붙어요. 앞뒤를 보고 누구인지 가려야 해요.' },
      { t: '사 부인', kind: '신분', who: '혼인한 뒤' },
      { t: '며느리', kind: '관계', who: '시아버지 유 소사가 부를 때' },
      { t: '질부', kind: '관계', who: '두 부인이 부를 때. 조카며느리라는 뜻' },
      { t: '투부', kind: '낮춤', who: '한림이 사씨를 내쫓을 때 교씨 앞에서. 투기하는(질투하는) 여자라는 뜻', tip: '사씨를 가리키는 말이지만 한림이 교씨의 말을 믿고 붙인 누명이에요.' },
      { t: '낭자', kind: '신분', who: '황릉묘에서 여승이 부를 때', tip: '번역마다 달라서 2018 수능 지문에서는 여승이 "부인"이라고 불러요.' },
    ],
    fate: '누명이 벗겨져 다시 정실로 돌아온다. 뒷날 여훈과 열녀전을 지었다고 한다.',
    pos: [26, 48],
  },
  yeonsu: {
    name: '유연수', full: '유연수', hanja: '劉延壽', side: 'yu', color: '#2f5b45',
    role: '유 소사의 외아들. 어린 나이에 과거에 급제한 한림학사',
    pt: { calm: 'pt_yeonsu_calm', angry: 'pt_yeonsu_angry', regret: 'pt_yeonsu_regret' },
    aliases: [
      { t: '유연수', kind: '이름', who: '서술' },
      { t: '연수', kind: '이름', who: '아버지와 서술' },
      { t: '한림', kind: '관직', who: '작품 대부분의 서술. 한림학사라는 벼슬 이름', tip: '관직 이름이 사람 이름처럼 쓰여요. 작품 속 "한림"은 거의 언제나 유연수예요.' },
      { t: '유 한림', kind: '관직', who: '서술' },
      { t: '상공', kind: '높임', who: '아내 사씨와 첩 교씨, 그리고 노파·설매 등이 부를 때' },
      { t: '현질', kind: '관계', who: '고모 두 부인이 부를 때. 어진 조카라는 뜻' },
      { t: '유 상서', kind: '관직', who: '귀양에서 풀려나 이부시랑을 거쳐 예부상서가 되었을 때' },
      { t: '유 승상', kind: '관직', who: '결말. 좌승상에 오른 뒤' },
    ],
    fate: '교씨의 말을 믿고 아내를 내쫓았다가 자신도 모함을 받아 귀양 간다. 뉘우친 뒤 사씨와 다시 만나고 좌승상에 오른다.',
    pos: [50, 36],
  },
  gyo: {
    name: '교씨', full: '교채란', hanja: '喬彩鸞', side: 'gyo', color: '#c4526a',
    role: '유연수의 첩. 벼슬하던 집안의 딸로 부모를 잃고 형에게 의지하던 처녀',
    pt: { smile: 'pt_gyo_smile', scheme: 'pt_gyo_scheme' },
    aliases: [
      { t: '교씨', kind: '성+씨', who: '서술' },
      { t: '교채란', kind: '본명', who: '본인의 이름' },
      { t: '교 낭자', kind: '신분', who: '첩으로 들어온 뒤 집안사람들이 부를 때', tip: '낭자는 젊은 여자를 부르는 말이라 다른 인물에게도 쓰여요.' },
      { t: '교 부인', kind: '신분', who: '사씨가 쫓겨나고 정실이 된 뒤. 한문본에서 설매가 이렇게 부름(경판본은 계속 "교 낭자")', tip: '"부인"이 붙었다고 사씨로 읽으면 안 돼요.' },
      { t: '교녀', kind: '낮춤', who: '서술자가 낮춰 부를 때' },
      { t: '첩', kind: '자칭', who: '교씨가 스스로를 낮춰 부를 때' },
    ],
    fate: '동청·냉진과 차례로 살다가 기생이 된다. 예부상서가 된 유연수에게 속아 끌려와 죄를 추궁당하고 처형된다.',
    pos: [74, 50],
  },
  dong: {
    name: '동청', full: '동청', hanja: '董靑', side: 'gyo', color: '#6f6457',
    role: '유씨 집안에 들어온 문객. 글씨 솜씨로 글 쓰는 일을 맡음',
    pt: { polite: 'pt_dong_polite', scheme: 'pt_dong_scheme' },
    aliases: [
      { t: '동청', kind: '이름', who: '서술' },
      { t: '문객', kind: '신분', who: '양반집에 얹혀살며 일을 돕는 손님' },
      { t: '낭군', kind: '관계', who: '교씨가 몰래 정을 통하며 부를 때', tip: '"낭군"은 흔히 남편을 가리키지만, 여기서는 유연수가 아니라 동청이에요. 둘의 사통 관계가 드러나는 말이에요.' },
      { t: '동 태수', kind: '관직', who: '계림태수가 된 뒤' },
    ],
    fate: '엄 승상에게 붙어 벼슬을 얻지만, 엄 승상이 권세를 잃은 뒤 냉진의 고발로 황제의 명에 따라 처형된다.',
    pos: [80, 24],
  },
  naengjin: {
    name: '냉진', full: '냉진', hanja: '冷振', side: 'gyo', color: '#34324a',
    role: '동청의 심복이자 친구',
    pt: { base: 'pt_naengjin' },
    aliases: [
      { t: '냉진', kind: '이름', who: '서술' },
    ],
    fate: '동청을 배신해 고발하고 교씨와 달아나지만 결국 죽는다.',
    pos: [94, 56],
  },
  napmae: {
    name: '납매', full: '납매', hanja: '臘梅', side: 'gyo', color: '#c98a3a',
    role: '교씨의 심복 시비(여종)',
    pt: { base: 'pt_napmae' },
    aliases: [
      { t: '납매', kind: '이름', who: '서술' },
      { t: '시비', kind: '신분', who: '곁에서 시중드는 여종', tip: '교씨의 시비인지 사씨의 시비인지 꼭 구별하세요.' },
    ],
    fate: '교씨의 음모를 도맡아 거든다.',
    pos: [88, 80],
  },
  seolmae: {
    name: '설매', full: '설매', hanja: '雪梅', side: 'sa', color: '#8e7fae',
    role: '사씨의 시비(여종). 납매의 꾐에 넘어가 교씨 편에 선다',
    pt: { base: 'pt_seolmae' },
    aliases: [
      { t: '설매', kind: '이름', who: '서술' },
      { t: '시비', kind: '신분', who: '곁에서 시중드는 여종', tip: '설매는 교씨가 아니라 사씨의 시비예요. 그래서 설매의 말이 사씨에게 더 큰 누명이 되었어요.' },
    ],
    fate: '차마 인아를 죽이지 못하고 살려 둔다. 뒤에 귀양에서 풀려난 한림을 만나 모든 진상을 털어놓는다.',
    pos: [12, 84],
  },
  chunbang: {
    name: '춘방', full: '춘방', hanja: '春芳', side: 'sa', color: '#6f9f86',
    role: '사씨의 시비(여종)',
    pt: { base: 'pt_chunbang' },
    aliases: [
      { t: '춘방', kind: '이름', who: '서술' },
    ],
    fate: '장주 사건의 누명을 쓰고도 끝내 없는 죄를 인정하지 않다가 목숨을 잃는다. 뒤에 사씨가 춘방을 위해 제문을 지었다(한문본 부록).',
    pos: [8, 62],
  },
  isipnang: {
    name: '이십낭', full: '이십낭', hanja: '李十娘', side: 'gyo', color: '#5b3f66',
    role: '방술(요사한 술법)에 능한 무녀',
    pt: { base: 'pt_isipnang' },
    aliases: [
      { t: '이십낭', kind: '이름', who: '서술. 이본에 따라 "십랑"이라고도 함' },
      { t: '무녀', kind: '신분', who: '굿과 방술을 하는 여자' },
    ],
    fate: '교씨와 짜고 저주 사건을 꾸민다.',
    pos: [82, 98],
  },
  dubuin: {
    name: '두 부인', full: '두 부인', hanja: '杜夫人', side: 'yu', color: '#6b5a48',
    role: '유 소사의 누이 = 유연수의 고모. 친정의 일을 돌봄',
    pt: { base: 'pt_dubuin' },
    aliases: [
      { t: '두 부인', kind: '신분', who: '서술. 두씨 집안에 시집갔기 때문에 붙은 호칭', tip: '사씨의 고모가 아니라 유연수의 고모예요.' },
      { t: '고모', kind: '관계', who: '유연수 쪽에서 부를 때' },
    ],
    fate: '처음부터 첩 들이기를 걱정하고 끝까지 사씨를 믿는다. 아들을 따라 장사로 떠났다가 돌아와 조카를 꾸짖고 용서한다.',
    pos: [20, 12],
  },
  yusosa: {
    name: '유 소사', full: '유 소사', hanja: '劉少師', side: 'yu', color: '#8c2f2a',
    role: '유연수의 아버지. 태자소사 벼슬을 지냄',
    pt: { base: 'pt_yusosa' },
    aliases: [
      { t: '유 소사', kind: '관직', who: '서술. 소사는 태자소사라는 벼슬 이름', tip: '"유 소사"는 유연수가 아니라 아버지예요. 이 게임에서 가장 많이 헷갈리는 호칭이에요.' },
      { t: '소사', kind: '관직', who: '서술', tip: '"한림"은 아들, "소사"는 아버지예요.' },
      { t: '시아버지', kind: '관계', who: '사씨 쪽에서' },
    ],
    fate: '아들이 혼인한 지 얼마 안 되어 세상을 떠난다. 뒤에 사씨의 꿈에 나타나 피할 길을 일러 준다.',
    pos: [50, 8],
  },
  ina: {
    name: '인아', full: '인아', hanja: '麟兒', side: 'sa', color: '#6a9cc9',
    role: '사씨의 아들',
    pt: { base: 'pt_ina' },
    aliases: [
      { t: '인아', kind: '이름', who: '서술', tip: '인아는 사씨의 아들, 장주는 교씨의 아들이에요.' },
    ],
    fate: '교씨의 명으로 물에 던져질 뻔했지만 설매가 강가 숲에 두고 온다. 임씨 집에서 자라 어머니와 다시 만난다.',
    pos: [30, 68],
  },
  jangju: {
    name: '장주', full: '장주', hanja: '掌珠', side: 'gyo', color: '#b8423a',
    role: '교씨의 첫아들. 인아보다 먼저 태어남',
    pt: { base: 'pt_jangju' },
    aliases: [
      { t: '장주', kind: '이름', who: '서술', tip: '장주는 교씨의 아들이에요. 교씨가 사씨보다 먼저 아들을 낳았어요.' },
    ],
    fate: '교씨 일당의 음모 속에 목숨을 잃고, 그 죄가 사씨에게 씌워진다.',
    pos: [68, 70],
  },
  nun: {
    name: '여승', full: '여승 묘희', hanja: '妙喜', side: 'help', color: '#8a8378',
    role: '관음보살 그림을 들고 처녀 사씨를 찾아왔던 여승. 뒤에 동정호 군산 수월암에 머묾',
    pt: { base: 'pt_nun' },
    aliases: [
      { t: '여승', kind: '신분', who: '서술. 여자 승려' },
      { t: '묘희', kind: '이름', who: '한문본 계열의 이름. 이본에 따라 "묘혜"', tip: '이본마다 이름이 달라서 이 게임은 주로 "여승"이라고 불러요.' },
    ],
    fate: '관음보살의 현몽을 받고 사씨를 구해 수월암으로 데려간다. 백빈주에서 쫓기던 한림을 구하는 일도 돕는다.',
    pos: [16, 110],
  },
  imssi: {
    name: '임씨', full: '임씨', hanja: '林氏', side: 'help', color: '#d9a58f',
    role: '여승의 조카딸. 집에서 거둔 아이(인아)를 동생처럼 기름',
    pt: { base: 'pt_imssi' },
    aliases: [
      { t: '임씨', kind: '성+씨', who: '서술. 이름은 이본마다 달라 쓰지 않음', tip: '임씨는 재취 부인이 아니라 사씨가 권해 들인 첩이에요.' },
    ],
    fate: '사씨의 권유로 유연수의 첩이 되고, 기르던 아이가 인아임이 밝혀진다.',
    pos: [42, 114],
  },
  eomsung: {
    name: '엄 승상', full: '엄숭', hanja: '嚴嵩', side: 'court', color: '#9b2d20',
    role: '명나라 가정 연간에 실제로 권세를 휘두른 재상 엄숭',
    pt: { base: 'pt_eomsung' },
    aliases: [
      { t: '엄 승상', kind: '관직', who: '서술' },
      { t: '엄숭', kind: '이름', who: '실존 인물의 이름' },
    ],
    fate: '권세를 잃고 물러난다(실제 역사에서도 1562년에 실각했다).',
    pos: [90, 8],
  },
  consorts: {
    name: '아황과 여영', full: '아황·여영', hanja: '娥皇·女英', side: 'help', color: '#4a5f8f',
    role: '요임금의 두 딸이자 순임금의 두 왕비. 황릉묘에 모셔진 신령',
    pt: { base: 'pt_consorts' },
    aliases: [
      { t: '아황과 여영', kind: '이름', who: '서술', tip: '순임금의 딸이 아니라 요임금의 딸이자 순임금의 왕비예요. 황릉묘는 무덤이 아니라 이들을 모신 사당이에요.' },
      { t: '두 왕비', kind: '신분', who: '서술' },
    ],
    fate: '꿈에서 사씨를 위로하고 앞일을 일러 준다. 실제로 사씨를 구한 것은 여승이다.',
    pos: [8, 32],
  },
  oldwoman: {
    name: '노파', full: '흰 옷 입은 노파', hanja: '', side: 'help', color: '#9a948a',
    role: '귀양지에서 앓던 한림의 꿈에 나타난 "동정 군산 사람"',
    pt: { base: 'pt_oldwoman' },
    aliases: [
      { t: '노파', kind: '신분', who: '서술. 늙은 여인', tip: '사씨가 아니에요. 스스로 동정 군산에서 왔다고 말해요.' },
    ],
    fate: '물병을 두고 가자 샘이 솟아 한림의 병이 낫는다.',
    pos: [72, 114],
  },
};

// 게임 설정(虛)의 인물: 관계도·호칭 도감에는 넣지 않는다
window.FRAME_PEOPLE = {
  owner: { name: '세책방 주인', pt: 'pt_owner', color: '#3f6f73' },
};

// 관계도의 선. at=선이 생기는 곳(단계 id), label=관계, kind=선 모양(bond 가족·혼인, ally 한편, foe 모함·해침, help 도움)
// states: 장이 지나며 관계가 바뀌면 [단계 id, 새 label, 새 kind, 점선 여부]
window.LINKS = [
  { a: 'yusosa', b: 'yeonsu', label: '아버지와 아들', kind: 'bond', at: 'p0a' },
  { a: 'dubuin', b: 'yeonsu', label: '고모와 조카', kind: 'bond', at: 'p0a' },
  { a: 'yeonsu', b: 'sassi', label: '부부', kind: 'bond', at: 'p0b',
    states: [['p3b', '내쫓음', 'foe', true], ['p5d', '다시 만남', 'help', false], ['pEa', '다시 부부', 'bond', false]] },
  { a: 'nun', b: 'sassi', label: '관음찬의 인연', kind: 'help', at: 'p0b', states: [['p4c', '구해 줌', 'help', false]] },
  { a: 'eomsung', b: 'yeonsu', label: '미워함', kind: 'foe', at: 'p1a' },
  { a: 'yeonsu', b: 'gyo', label: '첩', kind: 'bond', at: 'p1a' },
  { a: 'gyo', b: 'jangju', label: '어머니와 아들', kind: 'bond', at: 'p1a' },
  { a: 'yeonsu', b: 'dong', label: '문객으로 들임', kind: 'bond', at: 'p1b' },
  { a: 'sassi', b: 'ina', label: '어머니와 아들', kind: 'bond', at: 'p1b' },
  { a: 'gyo', b: 'isipnang', label: '결탁', kind: 'ally', at: 'p1b' },
  { a: 'gyo', b: 'dong', label: '사통', kind: 'ally', at: 'p1b' },
  { a: 'gyo', b: 'sassi', label: '원한', kind: 'foe', at: 'c_song', states: [['c_curse', '모함', 'foe', false]] },
  { a: 'gyo', b: 'napmae', label: '주인과 시비', kind: 'bond', at: 'c_curse' },
  { a: 'sassi', b: 'seolmae', label: '주인과 시비', kind: 'bond', at: 'p2a' },
  { a: 'dong', b: 'naengjin', label: '심복', kind: 'ally', at: 'c_ring' },
  { a: 'napmae', b: 'seolmae', label: '꾀어냄', kind: 'foe', at: 'c_ring' },
  { a: 'sassi', b: 'chunbang', label: '주인과 시비', kind: 'bond', at: 'c_jangju' },
  { a: 'consorts', b: 'sassi', label: '꿈속 위로', kind: 'help', at: 'p4b' },
  { a: 'dong', b: 'yeonsu', label: '모함', kind: 'foe', at: 'c_poem' },
  { a: 'eomsung', b: 'dong', label: '한편', kind: 'ally', at: 'c_poem' },
  { a: 'seolmae', b: 'ina', label: '살려 둠', kind: 'help', at: 'p5b' },
  { a: 'oldwoman', b: 'yeonsu', label: '병을 고침', kind: 'help', at: 'p5b' },
  { a: 'naengjin', b: 'dong', label: '고발', kind: 'foe', at: 'pEa' },
  { a: 'naengjin', b: 'gyo', label: '사통', kind: 'ally', at: 'pEa' },
  { a: 'nun', b: 'imssi', label: '고모와 조카딸', kind: 'bond', at: 'pEb' },
  { a: 'yeonsu', b: 'imssi', label: '첩', kind: 'bond', at: 'pEb' },
  { a: 'imssi', b: 'ina', label: '길러 줌', kind: 'help', at: 'pEb' },
];
