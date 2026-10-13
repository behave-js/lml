# today_card_macros
## Today · card + inline macros (variant A)

structure-note: Nourish Today variants (`today_card_macros`, `today_ring_hero`, `today_split_headline`) share baseline `dailyCalorieGoal=2000`, `consumedCalories=780`, `remainingCalories=1220` unless a variant block states otherwise. §3.9 `layout-variant`(breakpoint)와 무관 — layout exploration artboards.

모바일 홈 화면의 첫 번째 레이아웃 탐색안이다. 칼로리 링과 잔여 칼로리를 카드 상단에 가로로 배치하고, Protein·Carbs·Fat 진행 바를 같은 카드 안에 둔다. 하단에는 pill 내비(Home / Explore)와 우측 `Scan meal` FAB를 함께 둔다.

초기 artboard는 `today_card_macros`이다. `card_bottom_nav`의 Explore 선택 시 후속 Explore Page로 전환한다(아직 정의되지 않았으면 준비 중 안내). `card_scan_fab` 선택 시 식사 스캔 flow를 연다.

일일 목표는 `dailyCalorieGoal = 2000`, 현재 섭취 `consumedCalories = 780`, 잔여 `remainingCalories = 1220`이다.

# today_ring_hero
## Today · hero ring (variant B)

structure-note: Baseline nutrition data — `# today_card_macros`. Layout exploration only; not §3.9 breakpoint variant.

두 번째 레이아웃 탐색안이다. 큰 원형 게이지를 카드 중앙에 두고 잔여 칼로리를 링 안에 표시한다. 매크로 진행 바는 카드 밖 본문 영역에 세로로 배치하고, 하단 primary CTA는 전폭 pill 버튼 `Scan a meal` 하나로 단순화한다.

# today_split_headline
## Today · split headline (variant C)

structure-note: Baseline nutrition data — `# today_card_macros`. Layout exploration only; not §3.9 breakpoint variant.

세 번째 레이아웃 탐색안이다. 잔여 칼로리 숫자를 카드 왼쪽에 크게 두고 작은 링을 오른쪽에 배치한다. 매크로는 colored dot + slim bar 리스트 형식으로 같은 카드 하단에 둔다. 하단 CTA는 variant B와 동일한 전폭 `Scan meal` 버튼이다.

# card_brand
## Nourish
일일 칼로리·매크로를 추적하는 모바일 영양 앱.

# card_today_heading
TODAY

# card_calorie_ring
원형 칼로리 진행 링. `consumedCalories / dailyCalorieGoal` 비율(780 / 2000)을 arc로 표시한다.

# card_calorie_remaining
## 1220 calories left

# card_calorie_consumed
780 of 2000 kcal

# card_macro_protein
Protein · 45 / 150 g · 105 g left

# card_macro_carbs
Carbs · 65 / 250 g · 185 g left

# card_macro_fat
Fat · 38 / 70 g · 32 g left

# card_meals_heading
## Meals · 1 logged

# card_meal_image
grilled salmon quinoa bowl 썸네일.

# card_meal_title
grilled salmon quinoa bowl

# card_meal_calories
780 cal

# card_meal_macros
45p · 65c · 38f

# card_bottom_nav
Home · 선택됨 · Explore

Home은 현재 Today artboard를 유지한다. Explore 선택 시 탐색 feed Page로 전환한다.

# card_scan_fab
## Scan meal
카메라 기반 식사 인식 flow를 연다. 성공 시 meal item을 `loggedMeals`에 추가하고 칼로리·매크로 합계를 갱신한다.

# ring_brand
## Nourish

# ring_today_heading
## Today

# ring_calorie_ring
variant B용 큰 원형 게이지. 링 두께는 variant A보다 두껍게, 중앙에 잔여 칼로리 텍스트를 수용한다.

# ring_calorie_remaining
## 1220 calories left

# ring_calorie_consumed
780 of 2000 kcal

# ring_macro_protein
Protein · 48 g · 102 g left

# ring_macro_carbs
Carbs · 65 g · 185 g left

# ring_macro_fat
Fat · 38 g · 32 g left

# ring_meals_heading
## Meals · 1 logged

# ring_meal_image
grilled salmon quinoa bowl 썸네일.

# ring_meal_title
grilled salmon quinoa bowl

# ring_meal_calories
780 cal

# ring_meal_macros
45p 65c 38f

# ring_scan_action
## Scan a meal
카메라 아이콘과 함께 전폭 primary 버튼으로 표시한다. `card_scan_fab`과 동일한 scan flow를 연다.

# split_brand
## Nourish

# split_today_heading
## Today

# split_calorie_remaining
## 1220 calories left

# split_calorie_ring
variant C용 작은 원형 링. headline 오른쪽에 배치한다.

# split_macro_protein
Protein · 43g of 150g

# split_macro_carbs
Carbs · 65g of 250g

# split_macro_fat
Fat · 38g of 70g

# split_meals_heading
## Recently Logged · 1 meal

# split_meal_image
grilled salmon quinoa bowl 썸네일.

# split_meal_title
grilled salmon quinoa bowl

# split_meal_calories
780 cal

# split_meal_macros
43g P · 65g C · 38g F

# split_scan_action
## Scan meal
카메라 아이콘과 함께 전폭 primary 버튼으로 표시한다. scan flow는 variant B와 동일하다.

# sleep_home
## Sleep home · weekly dashboard
수면 추적 앱 홈 화면이다. 상단 greeting·날짜, 기간 탭(Week / 7-Night Avg / Score / Core), 주간 통계 카드, 어젯밤 요약 카드, 하단 tab bar로 구성된다.

초기 선택 탭은 `Week`이다. `sleep_period_tabs`에서 다른 탭을 선택하면 동일 Page 내 chart·stat emphasis를 바꾸거나 후속 Metrics Page로 전환한다(아직 정의되지 않았으면 chart legend만 갱신).

`sleep_go_to_sleep_action` 선택 시 수면 세션 시작 flow를 연다. `sleep_bottom_nav`의 Home은 현재 artboard를 유지하고, Metrics·Logs·Settings는 각각 후속 Page로 전환한다.

# sleep_greeting
## Seize the Day! 🌟

# sleep_info_action
(i)

선택 시 sleep score·consistency metric 설명 sheet를 연다.

# sleep_date
July 29, 2026

# sleep_period_tabs
Week · 선택됨 · 7-Night Avg · Score · Core

# sleep_stat_avg
AVG SLEEP · 7h 57m · last 7 nights

# sleep_stat_sleep_cons
SLEEP CONS. · 63% · bedtime rhythm

# sleep_stat_wake_cons
WAKE CONS. · 63% · wake rhythm

# sleep_stat_accuracy
ACCURACY · 64% · target match

# sleep_week_chart
Thu–Wed 7-night sleep bar chart.

Y-axis: 0h, 4h, 7.0h, 8h, 12h. Reference lines: 11:00 PM (bedtime target), 2 AM, 6:00 AM (wake target). 각 bar 아래 day label과 duration(7.7h, 8.4h, 7.5h, 8.0h, 7.8h, 8.2h, 7.6h)을 표시한다.

# sleep_last_night_heading
## Last Night's Sleep

# sleep_streak_badge
🔥 14

연속 기록 streak day count.

# sleep_last_night_duration
## 7h 48min

# sleep_last_night_trend
↘ 3%

전주 동일 요일 대비 변화율.

# sleep_go_to_sleep_action
## Go to Sleep
수면 추적 세션을 시작한다. 탭 시 recording state로 전환하고 버튼을 비활성화한다.

# sleep_tap_hint
Tap to start

# sleep_bottom_nav
Home · 선택됨 · Metrics · Logs · Settings

Home은 `sleep_home` artboard를 유지한다. Metrics·Logs·Settings 선택 시 각 tab destination Page로 전환한다.
