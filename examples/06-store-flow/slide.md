# catalog
## 상품 카탈로그 Page
상점의 시작 화면이다. 사용자는 상품을 검색하거나 카테고리로 좁히고 상품 카드를 선택해 상세 화면으로 이동한다.

초기 화면은 `catalog`이다. `catalog_product_*` 선택 시 선택한 상품을 `selectedProduct`에 저장하고 `product_detail`로 전환한다. `catalog_cart_action` 선택 시 `cart`로 전환한다.

# catalog_brand
## Morrow Store
일상을 오래 쓰게 만드는 생활용품 상점.

# catalog_search
검색 입력: "찾고 있는 상품을 검색하세요"

검색어가 바뀌면 상품 목록과 `catalog_result_count`를 갱신한다.

# catalog_cart_action
## 장바구니
현재 `cartCount`를 배지로 표시한다. 선택하면 `cart` Page로 전환한다.

# catalog_filter_title
## 카테고리

# catalog_category_all
전체 상품 · 선택됨

# catalog_category_living
리빙

# catalog_category_kitchen
키친

# catalog_category_stationery
문구

# catalog_heading
## 오늘의 상품
차분한 일상을 위한 여섯 가지 물건.

# catalog_result_count
상품 6개

# catalog_sort
정렬: 추천순

# catalog_product_lamp
## 포터블 테이블 램프
오트 베이지 · 89,000원

선택하면 `selectedProduct = lamp`로 설정하고 `product_detail`로 전환한다.

# catalog_product_mug
## 스톤웨어 머그
샌드 · 24,000원

선택하면 `selectedProduct = mug`로 설정하고 `product_detail`로 전환한다.

# catalog_product_tray
## 월넛 데스크 트레이
내추럴 · 42,000원

선택하면 `selectedProduct = tray`로 설정하고 `product_detail`로 전환한다.

# catalog_product_clock
## 미니멀 월 클락
오프화이트 · 58,000원

선택하면 `selectedProduct = clock`으로 설정하고 `product_detail`로 전환한다.

# catalog_product_notebook
## 리넨 노트북
포레스트 · 16,000원

선택하면 `selectedProduct = notebook`으로 설정하고 `product_detail`로 전환한다.

# catalog_product_blanket
## 코튼 블랭킷
웜 그레이 · 74,000원

선택하면 `selectedProduct = blanket`으로 설정하고 `product_detail`로 전환한다.

# catalog_shipping_note
50,000원 이상 주문 시 배송비 무료.

# catalog_support_note
평일 10:00–17:00 고객 지원.

# product_detail
## 상품 상세 Page
`selectedProduct`의 이미지, 가격, 설명과 구매 선택지를 보여준다. 예시는 포터블 테이블 램프를 선택한 상태다.

`detail_add_to_cart`는 현재 Page를 유지하면서 상품과 선택 수량을 `cartItems`에 추가하고 `cartCount`를 갱신한다. `detail_buy_now`는 동일하게 담은 뒤 `cart`로 전환한다.

# detail_brand
## Morrow Store

# detail_search
상품 검색

# detail_cart_action
장바구니 · 2

선택하면 `cart`로 전환한다.

# detail_breadcrumb_home
상품

선택하면 `catalog`로 전환한다.

# detail_breadcrumb_current
생활 조명 / 포터블 테이블 램프

# detail_product_gallery
포터블 테이블 램프의 대표 이미지와 보조 이미지 3장을 보여준다.

# detail_badge
BEST

# detail_product_name
## 포터블 테이블 램프
오트 베이지

# detail_rating
평점 4.8 · 후기 126개

# detail_price
## 89,000원

# detail_description
눈부심을 줄인 따뜻한 빛과 세 단계 밝기 조절. 충전 후 최대 18시간 사용할 수 있다.

# detail_quantity
수량 선택 · 1개

감소 버튼은 1보다 작게 만들지 않고 증가 버튼은 재고 수량을 넘지 않는다.

# detail_delivery
내일 출고 · 배송비 무료

# detail_add_to_cart
## 장바구니 담기
`cartItems[lamp].quantity += selectedQuantity`, `cartCount`를 다시 계산한다. 상품 상세 화면은 유지하고 담김 피드백을 표시한다.

# detail_buy_now
## 바로 구매
상품을 장바구니에 반영한 뒤 `cart`로 전환한다.

# detail_returns_note
수령 후 7일 이내 무료 반품.

# detail_secure_payment_note
안전 결제 지원.

# cart
## 장바구니 Page
선택한 상품, 수량, 가격과 주문 합계를 확인하는 화면이다.

수량 변경과 삭제마다 `subtotal = Σ(price × quantity)`를 재계산한다. `subtotal`이 50,000원 이상이면 배송비는 0원, 아니면 3,000원이다. `total = subtotal + shipping`이다.

# cart_brand
## Morrow Store

# cart_continue_shopping
쇼핑 계속하기

선택하면 `catalog`로 전환한다.

# cart_item_count
장바구니 · 상품 2종 / 총 3개

# cart_heading
## 장바구니

# cart_delivery_banner
무료 배송 조건을 충족했습니다.

# cart_lamp_image
포터블 테이블 램프 이미지

# cart_lamp_summary
## 포터블 테이블 램프
오트 베이지 · 89,000원

# cart_lamp_quantity
수량 1개

수량을 바꾸면 합계와 `cartCount`를 즉시 다시 계산한다.

# cart_lamp_remove
삭제

선택하면 램프를 `cartItems`에서 제거한다.

# cart_mug_image
스톤웨어 머그 이미지

# cart_mug_summary
## 스톤웨어 머그
샌드 · 24,000원

# cart_mug_quantity
수량 2개

수량을 바꾸면 합계와 `cartCount`를 즉시 다시 계산한다.

# cart_mug_remove
삭제

선택하면 머그를 `cartItems`에서 제거한다.

# cart_empty_slot_note
모든 상품이 삭제되면 빈 장바구니 안내와 `catalog`로 돌아가는 동작으로 대체한다.

# cart_summary_heading
## 주문 요약

# cart_subtotal_label
상품 금액

# cart_subtotal_value
137,000원

# cart_shipping_label
배송비

# cart_shipping_value
0원

# cart_total_label
## 총 결제 금액

# cart_total_value
## 137,000원

# cart_policy_note
주문 버튼 선택 시 구매 조건과 개인정보 처리방침에 동의한 것으로 본다.

# cart_checkout_action
## 주문하기
장바구니가 비어 있지 않으면 `checkout`으로 전환한다. 비어 있으면 현재 Page에서 안내한다.

# checkout
## 주문서 Page
배송 연락처와 결제 정보를 입력하고 최종 주문을 제출하는 화면이다.

필수 필드를 검사하여 오류가 있으면 현재 Page에 오류를 표시하고 첫 오류 필드로 이동한다. 제출 중에는 `submitting = true`로 두고 중복 제출을 막는다. 실패하면 입력값을 유지한 채 오류를 표시한다. 성공하면 주문 결과를 저장하고 `order_complete`로 전환한다.

# checkout_brand
## Morrow Store

# checkout_secure_label
보안 주문서

# checkout_back_to_cart
장바구니로 돌아가기

선택하면 입력 상태를 보존하고 `cart`로 전환한다.

# checkout_heading
## 주문서 작성

# checkout_step_indicator
장바구니 1 — 주문서 2 — 완료 3

# checkout_contact_heading
## 배송 정보

# checkout_name_field
받는 분 · 김민지

# checkout_phone_field
연락처 · 010-1234-5678

# checkout_address_field
주소 · 서울시 성동구 연무장길 12

# checkout_city_field
상세 주소 · 3층 301호

# checkout_postal_field
우편번호 · 04782

# checkout_payment_heading
## 결제 정보

# checkout_card_field
카드 번호 · •••• •••• •••• 4242 / 12·29 / 123

# checkout_validation_message
이름, 연락처, 주소와 유효한 결제 정보를 모두 입력해야 한다. 정상 상태에서는 메시지 영역을 비워 둔다.

# checkout_order_heading
## 주문 내역

# checkout_order_items
포터블 테이블 램프 × 1 · 89,000원

스톤웨어 머그 × 2 · 48,000원

# checkout_order_subtotal
상품 금액 · 137,000원

# checkout_order_shipping
배송비 · 0원

# checkout_order_total
## 최종 결제 · 137,000원

# checkout_submit_action
## 137,000원 결제하기
검증 성공 시 제출 중 상태를 표시하고 버튼을 비활성화한다. 결제 성공 시 주문 번호와 배송 예정일을 설정한 후 `order_complete`로 전환한다.

# order_complete
## 주문 완료 Page
주문 성공 결과를 확인하고 쇼핑을 계속하거나 주문 내역으로 이동하는 화면이다.

# complete_brand
## Morrow Store

# complete_help_action
도움이 필요하신가요?

# complete_success_icon
주문 완료를 나타내는 확인 아이콘.

# complete_heading
## 주문이 완료되었습니다
감사합니다. 결제 승인과 주문 접수가 정상 처리되었습니다.

# complete_order_number
주문 번호 · MS-20260910-1842

# complete_delivery_summary
배송 예정일 · 2026년 9월 12일 토요일

서울시 성동구 연무장길 12, 3층 301호로 배송합니다.

# complete_continue_action
## 쇼핑 계속하기
장바구니를 비우고 `catalog`로 전환한다.

# complete_history_action
## 주문 내역 보기
후속 구현의 주문 내역 화면 또는 계정 주문 목록으로 이동한다. 해당 화면이 아직 없으면 현재 Page를 유지하고 준비 중 안내를 표시한다.

# complete_receipt_note
영수증은 구매자 이메일로 발송되었습니다.

# complete_support_note
주문 문의 · help@morrow.example
