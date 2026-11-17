# Nâng cấp ReviewDock: triển khai và bằng chứng

**Trạng thái:** Đã triển khai cục bộ, gồm tinh chỉnh UI theo ảnh tham chiếu; chấp nhận provider còn chờ.

**Phạm vi:** Cải thiện điều hướng, đọc diff, quản lý thảo luận, sửa metadata, khám phá PR/MR và xem commit.

## Mục tiêu và phạm vi

Mở rộng ReviewDock để người dùng điều hướng cây kết nối đến PR/MR, xem diff có neo dòng chính xác, và thao tác với thảo luận/metadata trong VS Code. Duy trì khác biệt API và quyền của GitHub, GitLab; không giả lập tính năng mà provider không hỗ trợ.

Phạm vi đã triển khai cục bộ gồm: cây tệp phân cấp; unified/split diff với neo nguồn; Markdown source/rich; thao tác thảo luận và metadata; cây kết nối → repository → PR/MR tải lười; tab Commits; composer trả lời inline; quick scroll; status tags.

## Hành vi dự kiến

### Cây tệp và điều hướng diff

- Hiển thị file thay đổi theo cây thư mục phân cấp, giữ phân biệt thư mục/file và trạng thái thêm, sửa, xóa, đổi tên.
- Cho phép kéo thanh chia để đổi chiều rộng vùng cây, ẩn/hiện cây; mọi thao tác có thể thực hiện bằng bàn phím. Kéo không thay đổi thứ tự file.
- Chọn Layout Unified/Split toàn cục trong gear menu. Mỗi dòng hiển thị liên kết đến đúng đường dẫn và số dòng ở base hoặc head tương ứng; lựa chọn dòng phải dùng cùng ánh xạ vị trí mà thao tác comment yêu cầu.
- Mỗi file Markdown có icon segmented toggle Source/Rich ở header file. Cả hai lấy chính xác nội dung base và head từ nguồn tương ứng; không dựng nội dung đầy đủ bằng cách ghép patch. Nội dung không tin cậy phải được render an toàn, không thực thi HTML/script nhúng.

### Thảo luận và metadata

- Composer comment mở trong modal opaque (nền modal che nội dung phía sau), giữ ngữ cảnh PR/MR, file, dòng/side nếu là comment inline; modal hỗ trợ bàn phím và không làm mất nội dung khi lỗi gửi.
- Cho phép xóa comment và resolve thread chỉ khi loại thread/API của provider hỗ trợ. GitHub dùng GraphQL cho thao tác thread native được hỗ trợ; GitLab dùng REST. Giữ native thread/comment ID, quyền sở hữu/quyền thao tác và trạng thái kết quả; không đổi comment inline thành comment chung khi vị trí không hợp lệ.
- Cho phép sửa title, description, assignees, reviewers và labels. Gửi ID native của provider cho assignee/reviewer/label; giữ các lựa chọn hiện tại khi cập nhật một trường riêng lẻ. Báo rõ lỗi quyền hoặc trường hợp provider không hỗ trợ.
- Reply composer hiển thị ngay trong thread inline, không đặt trong footer chung.
- Quick scroll nằm ở góc dưới bên phải vùng diff để chuyển nhanh trong danh sách file.
- Hiển thị status tags dựa trên trạng thái provider; không suy diễn trạng thái khi dữ liệu thiếu.

### Khám phá kết nối

- Hiển thị cây lồng nhau: connection → repository/project → PR/MR. Chỉ tải nhánh con khi người dùng mở node; các danh sách phân trang theo adapter.
- Mỗi yêu cầu tải và thao tác phải gắn với connection đã chọn và qua guard xác thực/quyền trước khi truy cập credential hoặc gọi provider. Lỗi 401/403 và quyền thiếu hiển thị tại node/hoạt động tương ứng; không coi lỗi là danh sách rỗng.

### Tab Commits

- Thêm tab Commits cho PR/MR với danh sách phân trang. Mỗi hàng chỉ hiển thị subject, committer, committed time và short SHA; giữ native commit identity cho liên kết mở commit trên provider.
- Dùng GitHub Pull Request commits API hoặc GitLab Merge Request commits API tương ứng với request hiện tại. Chỉ tải trang tiếp theo theo hợp đồng phân trang của provider.
- Hiển thị trạng thái loading, empty và error riêng. Ưu tiên committer và committed time; khi provider thiếu dữ liệu này, dùng author/authored time làm dự phòng. Link chỉ xuất hiện khi provider cung cấp hợp lệ.

## Các phần đã triển khai cục bộ

- Cây file, resize/ẩn/hiện, bàn phím, unified/split anchors và Markdown source/rich.
- Composer comment opaque và reply composer nằm trong thread inline; xóa/resolve native theo capability.
- Chỉnh sửa metadata bằng ID native, giữ set hiện tại và phân biệt lỗi quyền/unsupported.
- Cây kết nối/repository/PR-MR tải lười và phân trang qua auth guard.
- Tab Commits phân trang; quick scroll phía dưới bên phải; status tags theo trạng thái provider.

## Bằng chứng xác minh

- **Kiểm tra tự động (snapshot):** 126 tests; typecheck, lint, format check và traceability check đều pass theo xác minh của owner. Số lượng là snapshot và có thể thay đổi khi code tiếp tục đổi.
- **VS Code UI (quan sát interim, chưa phải UI acceptance cuối):** VSIX interim được cài đặt và cửa sổ reload; trạng thái Connected còn giữ, PR hiển thị tag Merged, tab Changes hiển thị 13 file cùng cây, mode controls và quick scroll; tab Commits hiển thị 30 mục dữ liệu từ provider. Bản VSIX cuối đã được cài lại; lần thử reload để quan sát UI cuối bị chặn bởi lỗi điều khiển cửa sổ `noWindowsAvailable`, nên chưa có xác nhận trực quan cuối cho icon toggle và gear menu. Các controls này đã được kiểm tra qua component tests.
- **Rà soát an toàn:** backend safety review sạch sau khi pin revisions và sửa `rootCommentId` cho GitLab.
- **Giới hạn:** chưa thử live writes; rich Markdown chưa được xác minh đầy đủ trên host/provider thật. UI và API snapshots này không chứng minh chấp nhận GitHub/GitLab writes.

## Tiêu chí chấp nhận

- Cây tệp hiển thị phân cấp; thao tác kéo, đổi kích thước, ẩn/hiện đều dùng được bằng chuột và bàn phím.
- Unified/split trỏ đúng base/head path và line, kể cả rename, thêm/xóa file và hunk thiếu một phía; comment dùng đúng anchor hoặc báo không khả dụng.
- Markdown hiển thị thay đổi dựa trên chính xác nội dung hai revision; fixture có HTML/script không thể thực thi trong webview.
- Modal comment giữ nội dung/ngữ cảnh khi lỗi; xóa/resolve chỉ xuất hiện và chạy với thread/API được hỗ trợ và quyền hợp lệ.
- Sửa từng metadata field gửi đúng native IDs, giữ nguyên trường không sửa, và hiển thị permission/unsupported thay vì báo thành công.
- Cây connection/repository/PR-MR tải khi mở node, phân trang đến hết; request không thể dùng credential của connection khác và lỗi quyền không bị hiển thị thành empty state.
- Gear menu điều khiển Layout Unified/Split toàn cục; mỗi file Markdown có Source/Rich segmented toggle tại header; các dòng comment giữ neo nguồn hợp lệ.
- Tab Commits tải đúng danh sách theo trang, chỉ hiển thị subject/committer/committed time/short SHA và liên kết provider; empty, loading và error có trạng thái riêng.

## Kế hoạch kiểm tra tối thiểu

- **Unit:** ánh xạ cây đường dẫn; vị trí base/head qua hunk/rename/delete; vệ sinh và render Markdown; bảo toàn metadata chưa sửa; policy khả năng xóa/resolve theo provider.
- **Adapter contract:** đúng endpoint/method/payload/native IDs cho GitHub GraphQL và GitLab REST; phân trang; 401/403/unsupported; không retry mù mutation có kết quả không rõ.
- **Webview:** global Layout menu, per-file Markdown mode toggle, unified/split anchors, thao tác cây bằng bàn phím, modal submit/error, metadata preservation, trạng thái empty/loading/error.
- **Commits:** adapter contracts cho GitHub/GitLab pagination và mapping; webview kiểm tra loading, empty, error, và bốn trường hiển thị subject/committer/committed time/short SHA.
- **Extension/integration:** lazy load theo node, connection isolation và auth guard trước credential/provider call.
- **Provider acceptance:** xác minh trên GitHub và GitLab với tài nguyên thử nghiệm, gồm quyền thiếu, resolve/delete được hỗ trợ và nội dung Markdown khác nhau giữa base/head. Ghi rõ host/phiên bản; test giả lập không được xem là live acceptance.

## Quyết định và giới hạn

- Giữ nguyên provider-neutral application ports; adapter sở hữu endpoint, native IDs và khác biệt vị trí diff/thread.
- Danh sách assignee/reviewer/label và chi tiết capability cần lấy từ provider; không giả định tên hiển thị có thể thay cho ID.
- “Resolve native supported threads” chỉ áp dụng cho loại thread có API native tương ứng; triển khai cục bộ không hàm ý mọi loại thread đều hỗ trợ.
- Chưa quy định cách lưu kích thước/ẩn cây qua phiên VS Code, giới hạn kích thước nội dung Markdown, hay danh sách loại thread cụ thể ngoài hợp đồng provider. Chốt các chi tiết này khi khảo sát component/API liên quan, không mở rộng phạm vi.

## Theo dõi triển khai

Các tính năng trên đã có triển khai cục bộ; việc mutation live, chấp nhận provider, rich rendering đầy đủ, accessibility và tương thích Enterprise/Self-Managed vẫn là acceptance gates. Không đánh dấu các cổng này đạt chỉ dựa trên mock hoặc VS Code UI smoke.
