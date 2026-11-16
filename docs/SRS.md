# ReviewDock — Software Requirements Specification (SRS)

> **Mã tài liệu:** RVD-SRS-001  
> **Sản phẩm:** ReviewDock  
> **Loại tài liệu:** Software Requirements Specification  
> **Phiên bản:** 1.0.0-draft  
> **Trạng thái:** Draft — chờ Product Owner xác nhận  
> **Repository:** [minh-lb/vscode-reviewdock](https://github.com/minh-lb/vscode-reviewdock)  
> **Ngày:** 2026-11-16

---

## Kiểm soát tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Document ID | RVD-SRS-001 |
| Version | 1.0.0-draft |
| Product | ReviewDock |
| Target platform | Visual Studio Code Extension |
| Primary integration | GitLab REST API v4 |
| Document owner | Project maintainer |
| Implementation status | Not started |

### Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.1.0 | 2026-11-16 | Bản yêu cầu sản phẩm ban đầu |
| 1.0.0-draft | 2026-11-16 | Chuẩn hóa thành SRS: phạm vi, yêu cầu định danh, giao diện, chất lượng, bảo mật và tiêu chí xác minh |

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này xác định các yêu cầu phần mềm cho ReviewDock — extension của Visual Studio Code dùng để quản lý GitLab Merge Request (MR) và thực hiện code review trong IDE.

SRS là cơ sở để:
- Thiết kế kiến trúc và giao diện.
- Chia nhỏ công việc phát triển.
- Xây dựng test cases.
- Đánh giá mức độ hoàn thành theo từng requirement.
- Kiểm soát thay đổi phạm vi trước và trong quá trình triển khai.

Tài liệu mô tả **phần mềm cần làm gì và các điều kiện cần đáp ứng**, không quy định chi tiết implementation ở cấp class, function hoặc file source.

### 1.2. Phạm vi sản phẩm

ReviewDock cung cấp giao diện trong VS Code để người dùng:
1. Kết nối tới GitLab.com hoặc GitLab Self-Managed.
2. Chọn hoặc nhận diện GitLab project từ Git remote của workspace.
3. Tìm, lọc và xem Merge Request.
4. Đọc thay đổi code trong diff viewer.
5. Xem và tham gia discussions.
6. Tạo comment chung, inline comment và reply.
7. Theo dõi trạng thái pipeline và approval.
8. Merge MR khi người dùng có quyền và GitLab cho phép.

GitLab là nguồn dữ liệu có thẩm quyền. ReviewDock không thay thế cơ chế authorization, branch protection, approval rules, merge checks hoặc chính sách của GitLab project.

### 1.3. Quy ước từ khóa

Các từ khóa dưới đây có ý nghĩa bắt buộc trong tài liệu:

- **PHẢI (SHALL):** yêu cầu bắt buộc; sản phẩm không đạt nếu không đáp ứng.
- **NÊN (SHOULD):** yêu cầu được khuyến nghị; nếu không thực hiện phải có lý do được chấp thuận.
- **CÓ THỂ (MAY):** chức năng tùy chọn.
- **P0:** bắt buộc cho MVP.
- **P1:** dự kiến sau MVP.
- **P2:** định hướng mở rộng.

Mỗi yêu cầu có ID duy nhất để liên kết với thiết kế, implementation và test case.

### 1.4. Đối tượng đọc

- Product Owner / Project Maintainer.
- Software Architect.
- Developer.
- QA / Tester.
- Người review và bảo trì extension.

### 1.5. Tài liệu tham chiếu

- [Visual Studio Code Extension API](https://code.visualstudio.com/api)
- [Visual Studio Code UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview)
- [GitLab REST API](https://docs.gitlab.com/api/rest/)
- [GitLab Merge Requests API](https://docs.gitlab.com/api/merge_requests/)
- [GitLab Notes API](https://docs.gitlab.com/api/notes/)
- [GitLab Discussions API](https://docs.gitlab.com/api/discussions/)
- [GitLab Merge Request Approvals API](https://docs.gitlab.com/api/merge_request_approvals/)
- [GitLab Jobs API](https://docs.gitlab.com/api/jobs/)

Các endpoint, field và capability cụ thể phải được đối chiếu với phiên bản GitLab tối thiểu được chọn trước khi implementation.

## 2. Mô tả tổng thể

### 2.1. Bối cảnh hệ thống

ReviewDock là một VS Code extension chạy trong Extension Host. Extension giao tiếp trực tiếp với GitLab instance do người dùng cấu hình thông qua HTTPS và GitLab REST API.

ReviewDock không yêu cầu một backend riêng trong MVP. Token và cấu hình kết nối được quản lý trong phạm vi VS Code trên máy người dùng.

### 2.2. Chức năng tổng quát

| Nhóm | Chức năng |
|---|---|
| Connection | Kết nối, xác thực, ngắt kết nối GitLab |
| Project | Nhận diện Git remote, chọn và cấu hình project |
| MR discovery | Danh sách, tìm kiếm, lọc và phân trang MR |
| MR detail | Metadata, trạng thái, branch, reviewer và mô tả |
| Code review | Danh sách file thay đổi, diff và điều hướng |
| Discussions | Comment chung, inline comment, reply |
| Approval | Xem approval; approve/unapprove nếu được bật và được phép |
| Pipeline | Xem pipeline và job liên quan |
| Merge | Kiểm tra trạng thái, xác nhận và yêu cầu GitLab merge |
| Settings | Quản lý instance, project và tùy chọn extension |

### 2.3. Nhóm người dùng

| Actor | Mô tả | Quyền phụ thuộc |
|---|---|---|
| Developer / Author | Người tạo hoặc đóng góp vào MR | Quyền GitLab của tài khoản |
| Reviewer | Người được yêu cầu review hoặc được assign | Quyền đọc và review trên project |
| Maintainer | Người quản lý project và quy trình merge | Quyền project và branch policy |
| GitLab Instance | Hệ thống ngoài cung cấp API và thực thi policy | Phiên bản, cấu hình và trạng thái server |
| VS Code | Host chạy extension và cung cấp UI/storage APIs | Phiên bản VS Code tương thích |

ReviewDock PHẢI phản ánh quyền mà GitLab API cấp; không tự cấp thêm quyền cho bất kỳ actor nào.

### 2.4. Môi trường vận hành

- Visual Studio Code Stable trên Windows, macOS và Linux.
- GitLab.com.
- GitLab Self-Managed trong phạm vi phiên bản được công bố.
- Kết nối mạng tới GitLab instance qua HTTPS.
- Workspace có thể chứa một hoặc nhiều Git repository.

Minimum VS Code engine version và minimum GitLab version là các quyết định cần chốt tại mục 12.

### 2.5. Ràng buộc thiết kế

- Sản phẩm PHẢI được phát hành dưới dạng VS Code extension.
- Ngôn ngữ triển khai dự kiến là TypeScript.
- GitLab integration PHẢI dùng API được GitLab công bố; không scrape giao diện GitLab Web.
- Secret PHẢI được lưu bằng VS Code SecretStorage.
- UI PHẢI tuân thủ lifecycle và security model của VS Code Extension API.
- Không có thao tác nào được bypass GitLab authorization hoặc project policy.

### 2.6. Giả định và phụ thuộc

- Người dùng có GitLab account và quyền truy cập project tương ứng.
- GitLab instance cho phép API access và token được cấp đủ scope.
- Các API cần thiết tồn tại trong phiên bản GitLab được hỗ trợ.
- VS Code SecretStorage khả dụng trong môi trường vận hành.
- Trạng thái MR có thể thay đổi bởi người dùng khác trong lúc ReviewDock đang mở; do đó dữ liệu hiển thị có thể stale.

## 3. Yêu cầu giao diện ngoài

### 3.1. Giao diện người dùng

**UI-001 (P0):** Extension PHẢI cung cấp entry point có tên ReviewDock trong Activity Bar hoặc vị trí điều hướng tương đương của VS Code.

**UI-002 (P0):** Extension PHẢI cung cấp view hiển thị project đang chọn và các nhóm Merge Request.

**UI-003 (P0):** Người dùng PHẢI có thể mở MR detail từ danh sách MR.

**UI-004 (P0):** MR detail PHẢI cung cấp điều hướng tới Overview, Changes và Discussions.

**UI-005 (P1):** MR detail NÊN cung cấp khu vực riêng cho Pipeline và Approvals.

**UI-006 (P0):** Các view PHẢI có trạng thái Loading, Empty, Error, Authentication Required và Permission Denied phù hợp.

**UI-007 (P0):** Các thao tác ghi PHẢI có trạng thái đang xử lý, ngăn submit lặp trong cùng thao tác và thông báo kết quả.

**UI-008 (P0):** Các thao tác quan trọng PHẢI dùng label/confirmation đủ rõ; không chỉ dựa vào màu hoặc icon.

**UI-009 (P0):** Các view và thao tác chính PHẢI hỗ trợ keyboard navigation theo quy ước VS Code.

**UI-010 (P1):** Extension NÊN sử dụng theme colors và accessibility conventions của VS Code.

### 3.2. Giao diện phần mềm

**IF-001 (P0):** Extension PHẢI sử dụng VS Code Extension API cho activation, commands, views, editor integration và secret storage.

**IF-002 (P0):** Extension PHẢI giao tiếp với GitLab thông qua GitLab REST API v4 qua HTTPS.

**IF-003 (P0):** Extension PHẢI đọc Git remote từ workspace thông qua cơ chế phù hợp của VS Code/Git để đề xuất project mapping.

**IF-004 (P0):** Extension KHÔNG ĐƯỢC yêu cầu người dùng cài một backend service riêng để sử dụng các chức năng MVP.

**IF-005 (P0):** UI layer KHÔNG ĐƯỢC gọi GitLab HTTP API trực tiếp; request phải đi qua lớp integration/service.

### 3.3. Giao diện truyền thông

**COM-001 (P0):** Request tới GitLab PHẢI dùng HTTPS.

**COM-002 (P0):** Request và response PHẢI xử lý JSON theo contract của GitLab API.

**COM-003 (P0):** Client PHẢI hỗ trợ pagination theo response/header/API contract của GitLab.

**COM-004 (P0):** Client PHẢI xử lý rate limit và HTTP status codes mà không làm crash extension.

**COM-005 (P0):** Client KHÔNG ĐƯỢC ghi access token hoặc Authorization header vào log.

## 4. Yêu cầu chức năng

### 4.1. Kết nối và xác thực GitLab

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| AUTH-001 | P0 | Hệ thống PHẢI cho phép cấu hình GitLab.com. |
| AUTH-002 | P0 | Hệ thống PHẢI cho phép cấu hình base URL của GitLab Self-Managed. |
| AUTH-003 | P0 | Hệ thống PHẢI xác thực request bằng phương thức được Product Owner chọn trước implementation (PAT hoặc OAuth 2.0). |
| AUTH-004 | P0 | Hệ thống PHẢI lưu credential bằng VS Code SecretStorage. |
| AUTH-005 | P0 | Hệ thống PHẢI kiểm tra credential bằng một API request phù hợp và hiển thị kết quả kết nối. |
| AUTH-006 | P0 | Hệ thống PHẢI cho phép người dùng thay credential và disconnect GitLab instance. |
| AUTH-007 | P0 | Hệ thống PHẢI xử lý token hết hạn, bị thu hồi hoặc không đủ scope bằng thông báo có hướng khắc phục. |
| AUTH-008 | P0 | Hệ thống KHÔNG ĐƯỢC lưu credential trong settings.json, workspace file hoặc source code. |

### 4.2. Project và workspace

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| PROJ-001 | P0 | Người dùng PHẢI có thể chọn GitLab project mà họ có quyền truy cập. |
| PROJ-002 | P0 | Hệ thống PHẢI đọc Git remote của workspace để đề xuất project tương ứng khi có thể nhận diện. |
| PROJ-003 | P0 | Người dùng PHẢI có thể nhập/chọn project thủ công khi không nhận diện được remote. |
| PROJ-004 | P0 | Hệ thống PHẢI hiển thị GitLab instance và project đang active. |
| PROJ-005 | P1 | Hệ thống NÊN hỗ trợ nhiều GitLab instance và project trong một workspace hoặc profile người dùng. |
| PROJ-006 | P0 | Hệ thống KHÔNG ĐƯỢC gửi repository URL hoặc workspace metadata tới dịch vụ bên thứ ba. |

### 4.3. Danh sách và tìm kiếm Merge Request

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| MR-001 | P0 | Hệ thống PHẢI hiển thị Merge Request thuộc project đang active. |
| MR-002 | P0 | Hệ thống PHẢI hỗ trợ lọc MR theo trạng thái Open, Closed và Merged. |
| MR-003 | P0 | Hệ thống PHẢI cung cấp các nhóm Created by me, Assigned to me và Review requested from me trong phạm vi API và quyền GitLab hỗ trợ. |
| MR-004 | P0 | Người dùng PHẢI có thể tìm MR theo IID hoặc title. |
| MR-005 | P0 | Danh sách MR PHẢI hỗ trợ pagination hoặc tải thêm. |
| MR-006 | P0 | Mỗi item MR PHẢI hiển thị tối thiểu title, IID, author, source branch, target branch, state và updated time. |
| MR-007 | P0 | Item MR NÊN hiển thị draft state, reviewer/assignee, labels và trạng thái mergeability khi API cung cấp. |
| MR-008 | P0 | Người dùng PHẢI có thể refresh danh sách MR. |
| MR-009 | P0 | Sau một mutation thành công, dữ liệu MR liên quan PHẢI được refresh hoặc đánh dấu stale. |
| MR-010 | P1 | Người dùng CÓ THỂ mở MR tương ứng trên GitLab Web. |

### 4.4. Chi tiết Merge Request

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| DETAIL-001 | P0 | Hệ thống PHẢI hiển thị title, IID, description, author, state và timestamps của MR. |
| DETAIL-002 | P0 | Hệ thống PHẢI hiển thị source branch và target branch. |
| DETAIL-003 | P0 | Hệ thống PHẢI hiển thị assignees, reviewers và labels khi API cung cấp. |
| DETAIL-004 | P0 | Hệ thống PHẢI hiển thị số commit, số file thay đổi, additions và deletions khi API cung cấp. |
| DETAIL-005 | P0 | Hệ thống PHẢI cho phép người dùng refresh MR detail. |
| DETAIL-006 | P0 | Hệ thống PHẢI phân biệt dữ liệu mới tải với dữ liệu cache/stale. |

### 4.5. Diff và code review

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| DIFF-001 | P0 | Hệ thống PHẢI tải và hiển thị danh sách file thay đổi của MR. |
| DIFF-002 | P0 | Hệ thống PHẢI hiển thị nội dung diff của file được chọn. |
| DIFF-003 | P0 | Hệ thống PHẢI hỗ trợ hiển thị unified diff; side-by-side diff có thể dùng native VS Code diff editor. |
| DIFF-004 | P0 | Hệ thống PHẢI thể hiện file added, modified, deleted và renamed khi API cung cấp trạng thái đó. |
| DIFF-005 | P0 | Hệ thống PHẢI hiển thị line number và dấu hiệu additions/deletions khi diff có thông tin tương ứng. |
| DIFF-006 | P0 | Hệ thống PHẢI cho phép điều hướng từ file list tới diff tương ứng. |
| DIFF-007 | P0 | Hệ thống PHẢI hỗ trợ tạo inline comment trên dòng/đoạn dòng hợp lệ của diff. |
| DIFF-008 | P0 | Hệ thống PHẢI hiển thị discussion liên quan tại vị trí code tương ứng khi GitLab cung cấp position metadata. |
| DIFF-009 | P0 | Hệ thống PHẢI xử lý file binary, diff quá lớn, patch không khả dụng hoặc file không có diff text bằng trạng thái/giải thích phù hợp. |
| DIFF-010 | P0 | Khi diff version thay đổi hoặc position không còn hợp lệ, hệ thống PHẢI yêu cầu refresh diff trước khi gửi inline comment. |
| DIFF-011 | P1 | Hệ thống NÊN hỗ trợ mở file tương ứng trong working tree khi xác định được mapping an toàn. |

**Quy tắc vị trí inline comment:** khi tạo discussion trên diff, client PHẢI dùng position metadata theo GitLab API, bao gồm các SHA và path/line fields mà endpoint yêu cầu. Client KHÔNG ĐƯỢC tự chuyển một inline comment thất bại thành comment chung.

### 4.6. Comments và discussions

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| DISC-001 | P0 | Hệ thống PHẢI tải và hiển thị notes/discussions của MR. |
| DISC-002 | P0 | Người dùng PHẢI có thể tạo comment chung cho MR. |
| DISC-003 | P0 | Người dùng PHẢI có thể tạo inline comment trên diff hợp lệ. |
| DISC-004 | P0 | Người dùng PHẢI có thể reply vào discussion khi GitLab cho phép. |
| DISC-005 | P0 | Comment PHẢI hiển thị author, nội dung và timestamp. |
| DISC-006 | P0 | Discussion PHẢI thể hiện trạng thái resolved/unresolved khi API cung cấp. |
| DISC-007 | P1 | Người dùng CÓ THỂ resolve/reopen discussion nếu GitLab API và quyền tài khoản cho phép. |
| DISC-008 | P1 | Người dùng CÓ THỂ edit/delete comment của chính mình nếu GitLab API và quyền tài khoản cho phép. |
| DISC-009 | P0 | Hệ thống PHẢI ngăn submit lặp trong khi request gửi comment đang chạy. |
| DISC-010 | P0 | Nếu request tạo comment timeout và kết quả không xác định, hệ thống PHẢI refresh discussions trước khi cho phép người dùng retry; không tự retry mutation một cách mù quáng. |
| DISC-011 | P0 | Hệ thống PHẢI hiển thị lỗi của GitLab khi comment/reply bị từ chối do permission, validation, diff position hoặc trạng thái MR. |

### 4.7. Approval và review decision

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| APR-001 | P1 | Hệ thống NÊN hiển thị approval rules và số approval hiện tại/yêu cầu khi GitLab API cung cấp. |
| APR-002 | P1 | Hệ thống NÊN hiển thị danh sách người đã approve và trạng thái approval. |
| APR-003 | P1 | Hệ thống CÓ THỂ cho phép approve/unapprove khi API và quyền cho phép. |
| APR-004 | P0 | Hệ thống PHẢI phân biệt comment với approval; tạo comment không được xem là approve. |
| APR-005 | P0 | Hệ thống KHÔNG ĐƯỢC tự kết luận MR đủ approval nếu GitLab không xác nhận. |

### 4.8. Pipeline và jobs

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| PIPE-001 | P1 | Hệ thống NÊN hiển thị pipeline mới nhất liên quan tới MR/head commit. |
| PIPE-002 | P1 | Hệ thống NÊN hiển thị trạng thái pipeline theo dữ liệu GitLab trả về. |
| PIPE-003 | P1 | Hệ thống NÊN hiển thị danh sách job và thông tin cơ bản của job thất bại khi API cho phép. |
| PIPE-004 | P1 | Người dùng CÓ THỂ mở pipeline/job trên GitLab Web. |
| PIPE-005 | P0 | Hệ thống KHÔNG ĐƯỢC hiển thị dữ liệu cache như trạng thái pipeline hiện tại nếu chưa xác minh freshness. |

### 4.9. Merge operation

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| MERGE-001 | P0 | Hệ thống PHẢI hiển thị trạng thái mergeability/merge status do GitLab cung cấp. |
| MERGE-002 | P0 | Hệ thống PHẢI chỉ cho phép bắt đầu thao tác merge khi user có quyền và trạng thái hiện tại không cho thấy thao tác chắc chắn bị chặn. |
| MERGE-003 | P0 | Hệ thống PHẢI yêu cầu xác nhận rõ ràng trước khi gửi merge request. |
| MERGE-004 | P0 | Trước khi merge, hệ thống PHẢI refresh dữ liệu cần thiết và gửi expected source/head SHA nếu GitLab endpoint hỗ trợ. |
| MERGE-005 | P1 | Hệ thống NÊN hỗ trợ squash hoặc merge options theo cấu hình project và API. |
| MERGE-006 | P0 | Hệ thống PHẢI hiển thị kết quả merge từ GitLab và refresh trạng thái MR sau thao tác. |
| MERGE-007 | P0 | Hệ thống PHẢI xử lý merge conflict, missing approval, pipeline failure, SHA mismatch và permission denied. |
| MERGE-008 | P0 | Hệ thống KHÔNG ĐƯỢC bypass protected branch, approval rules, merge checks hoặc quyền GitLab. |
| MERGE-009 | P0 | Hệ thống KHÔNG ĐƯỢC tự bật merge-when-pipeline-succeeds nếu người dùng chưa chọn rõ ràng. |
| MERGE-010 | P0 | Hệ thống KHÔNG ĐƯỢC tự retry merge request khi kết quả request trước đó không xác định; phải refresh trạng thái MR trước. |

## 5. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-001 | GitLab là nguồn dữ liệu có thẩm quyền cho trạng thái MR, pipeline, approval và kết quả merge. |
| BR-002 | Quyền thao tác phụ thuộc vào user token và quyền project trên GitLab. |
| BR-003 | Comment chung, inline comment, reply, resolve và approval là các hành động khác nhau; UI không được đánh đồng. |
| BR-004 | Inline comment chỉ hợp lệ khi vị trí gắn với diff version mà GitLab chấp nhận. |
| BR-005 | Client-side merge eligibility chỉ là thông tin hỗ trợ; quyết định cuối cùng thuộc GitLab server. |
| BR-006 | Dữ liệu cache có thể cũ; thao tác ghi quan trọng phải refresh trạng thái cần thiết trước khi thực hiện. |
| BR-007 | Không có thao tác ghi nào được thực hiện ngầm hoặc chỉ dựa trên việc mở một MR. |
| BR-008 | Không được dùng ReviewDock để né tránh branch protection hoặc policy của project. |

## 6. Yêu cầu dữ liệu

### 6.1. Dữ liệu được xử lý

| Nhóm dữ liệu | Ví dụ | Xử lý |
|---|---|---|
| Connection | GitLab base URL, user identity | Lưu cấu hình không nhạy cảm; credential lưu riêng |
| Project | Project ID, path, web URL, remote mapping | Lưu theo cấu hình workspace/user khi cần |
| Merge Request | IID, title, branches, state, SHA, metadata | Tải từ GitLab; cache tạm thời nếu cần |
| Diff | File path, patch, line positions, diff SHAs | Tải khi người dùng mở Changes |
| Discussion | Note ID, author, body, timestamp, position, resolution | Tải từ GitLab |
| Pipeline | Pipeline ID, status, jobs, web URL | Tải khi người dùng mở khu vực pipeline |
| Approval | Rules, approvals, users | Tải khi người dùng mở khu vực approval |
| Credential | PAT/OAuth secret | Chỉ lưu bằng SecretStorage |

### 6.2. Lưu trữ và vòng đời dữ liệu

**DATA-001 (P0):** Credential PHẢI được lưu tách biệt khỏi cấu hình thông thường bằng SecretStorage.

**DATA-002 (P0):** Cấu hình không nhạy cảm chỉ được lưu ở global/workspace state hoặc settings phù hợp.

**DATA-003 (P0):** Dữ liệu MR, diff và discussion mặc định NÊN được giữ trong bộ nhớ; persistent cache phải có quyết định riêng.

**DATA-004 (P0):** Khi disconnect, hệ thống PHẢI xóa credential tương ứng khỏi SecretStorage.

**DATA-005 (P0):** Hệ thống KHÔNG ĐƯỢC ghi token, private diff hoặc comment content vào diagnostic log.

**DATA-006 (P0):** Hệ thống PHẢI tránh lưu dữ liệu GitLab của một instance vào cache key dùng chung với instance khác.

## 7. Yêu cầu phi chức năng

### 7.1. Hiệu năng

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-PERF-001 | P0 | Extension activation KHÔNG ĐƯỢC chờ hoàn thành request mạng tới GitLab. |
| NFR-PERF-002 | P0 | Khi người dùng kích hoạt một view cần dữ liệu mạng, UI PHẢI hiển thị loading state trước khi request hoàn tất. |
| NFR-PERF-003 | P0 | Danh sách MR PHẢI dùng pagination; diff và discussions chỉ tải khi cần. |
| NFR-PERF-004 | P0 | Network request PHẢI hỗ trợ timeout và cancellation khi view/context không còn cần kết quả. |
| NFR-PERF-005 | P0 | Các thao tác UI cục bộ không được đồng bộ chờ network trên extension event loop. |

### 7.2. Bảo mật và quyền riêng tư

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-SEC-001 | P0 | Token PHẢI được lưu bằng SecretStorage. |
| NFR-SEC-002 | P0 | Token KHÔNG ĐƯỢC xuất hiện trong log, telemetry, exception message hoặc settings. |
| NFR-SEC-003 | P0 | Token chỉ được gửi tới GitLab host do người dùng cấu hình/xác nhận. |
| NFR-SEC-004 | P0 | Kết nối tới GitLab PHẢI dùng HTTPS và xác minh TLS theo trust store của môi trường. |
| NFR-SEC-005 | P0 | Extension KHÔNG ĐƯỢC gửi source code, diff, comment hoặc credential tới dịch vụ bên thứ ba. |
| NFR-SEC-006 | P0 | Extension PHẢI tôn trọng quyền API của tài khoản; không bypass authorization. |
| NFR-SEC-007 | P0 | Thao tác merge PHẢI có xác nhận rõ ràng. |
| NFR-SEC-008 | P0 | Disconnect PHẢI xóa credential được ReviewDock quản lý cho instance đó. |
| NFR-SEC-009 | P0 | Telemetry không được bật mặc định trong MVP; việc bổ sung telemetry cần có thiết kế privacy và consent riêng. |

### 7.3. Độ tin cậy và khả năng phục hồi

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-REL-001 | P0 | API/network error KHÔNG ĐƯỢC làm crash extension host. |
| NFR-REL-002 | P0 | Lỗi phải được phân loại tối thiểu thành authentication, authorization, not found, validation, rate limit, network và server error. |
| NFR-REL-003 | P0 | Mutation không được tự động retry nếu có nguy cơ tạo comment hoặc merge trùng. |
| NFR-REL-004 | P0 | Hệ thống PHẢI cho phép người dùng refresh sau lỗi tạm thời. |
| NFR-REL-005 | P0 | Khi dữ liệu không thể refresh, UI PHẢI chỉ ra dữ liệu đang hiển thị có thể stale. |

### 7.4. Tương thích và khả chuyển

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-COMP-001 | P0 | Extension PHẢI hỗ trợ Windows, macOS và Linux trong phạm vi VS Code engine được công bố. |
| NFR-COMP-002 | P0 | Extension PHẢI hỗ trợ GitLab.com. |
| NFR-COMP-003 | P0 | Extension PHẢI hỗ trợ GitLab Self-Managed trong phạm vi phiên bản đã công bố. |
| NFR-COMP-004 | P0 | Minimum VS Code engine version và minimum GitLab version PHẢI được công bố trước release MVP. |

### 7.5. Khả năng bảo trì và kiểm thử

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-MAIN-001 | P0 | Codebase PHẢI sử dụng TypeScript strict mode. |
| NFR-MAIN-002 | P0 | Domain/business logic PHẢI tách khỏi VS Code UI và GitLab HTTP transport đủ để unit test. |
| NFR-MAIN-003 | P0 | GitLab response PHẢI được validate/map trước khi sử dụng trong domain/UI. |
| NFR-MAIN-004 | P0 | Các module API quan trọng PHẢI có unit/integration tests. |
| NFR-MAIN-005 | P0 | Lỗi log phải hữu ích cho chẩn đoán nhưng không chứa secret hoặc dữ liệu nhạy cảm. |

### 7.6. Khả năng sử dụng và accessibility

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-UX-001 | P0 | Người dùng PHẢI thực hiện được các workflow chính bằng keyboard. |
| NFR-UX-002 | P0 | Trạng thái không được chỉ biểu đạt bằng màu sắc. |
| NFR-UX-003 | P0 | Action có tác động dữ liệu PHẢI có tên và kết quả dễ hiểu. |
| NFR-UX-004 | P1 | Extension NÊN hỗ trợ VS Code theme và accessibility labels. |

## 8. Xử lý lỗi

| Mã | Điều kiện | Hành vi bắt buộc |
|---|---|---|
| ERR-001 | Token invalid/expired/revoked | Báo kết nối không hợp lệ; hướng dẫn reconnect; không retry liên tục |
| ERR-002 | HTTP 403 | Báo không đủ quyền; không đề xuất bypass |
| ERR-003 | HTTP 404 | Báo project/MR/resource không còn khả dụng |
| ERR-004 | HTTP 400/422 | Hiển thị validation error có thể hành động |
| ERR-005 | HTTP 429 | Tôn trọng rate limit/retry guidance của GitLab |
| ERR-006 | Timeout/network failure | Báo lỗi kết nối; cho phép refresh/retry an toàn |
| ERR-007 | Stale diff position | Bắt buộc reload diff trước khi tạo inline comment |
| ERR-008 | Merge conflict / policy rejection | Hiển thị trạng thái và thông tin GitLab trả về; không giả lập merge thành công |
| ERR-009 | SHA mismatch | Refresh MR và yêu cầu người dùng thực hiện lại thao tác có xác nhận |
| ERR-010 | GitLab API capability/version không tương thích | Thông báo chức năng không được hỗ trợ trên instance đó |

## 9. Yêu cầu kiểm thử và xác minh

### 9.1. Phương pháp xác minh

Mỗi requirement phải được xác minh bằng một hoặc nhiều phương pháp:

- **Test:** unit, integration hoặc end-to-end test.
- **Inspection:** kiểm tra source, cấu hình, log hoặc tài liệu.
- **Demonstration:** thực hiện workflow trên VS Code/GitLab.
- **Analysis:** phân tích API contract, security behavior hoặc performance.

### 9.2. Ma trận xác minh tối thiểu

| Phạm vi | Kịch bản xác minh | Kết quả mong đợi |
|---|---|---|
| Authentication | Token hợp lệ/không hợp lệ; disconnect | Kết nối đúng trạng thái; secret không lộ |
| Project | Remote match và remote không match | Đề xuất đúng hoặc cho phép chọn thủ công |
| MR list | Filter, search, pagination | Kết quả khớp GitLab và không bỏ sót trang |
| MR detail | MR open/closed/merged | Metadata hiển thị đúng |
| Diff | Added/modified/deleted/renamed/binary | Hiển thị đúng hoặc fallback có giải thích |
| Comment | General comment và reply | Note xuất hiện trên GitLab |
| Inline comment | Diff position hợp lệ và stale | Gửi đúng vị trí; stale bị từ chối an toàn |
| Approval | Có/không đủ quyền approve | Hiển thị trạng thái/quyền đúng |
| Pipeline | Pending/success/failed | Hiển thị theo dữ liệu GitLab |
| Merge | Merge success và policy rejection | Không merge khi GitLab từ chối; kết quả được phản ánh chính xác |
| Security | Inspect settings/log/disconnect | Không có token trong nơi không an toàn |
| Resilience | Offline, timeout, 401, 403, 429, 5xx | Extension không crash; lỗi được phân loại |

### 9.3. Điều kiện chấp nhận MVP

MVP chỉ được chấp nhận khi tất cả tiêu chí sau được xác minh:

1. Kết nối GitLab và quản lý credential an toàn.
2. Chọn/nhận diện project.
3. Hiển thị MR list có filter và pagination.
4. Hiển thị MR detail.
5. Hiển thị diff và file changes.
6. Tạo general comment, inline comment và reply discussion.
7. Merge MR khi GitLab cho phép và người dùng xác nhận.
8. Xử lý các lỗi authentication, permission, network, stale diff, SHA mismatch và merge rejection.
9. Không bypass GitLab permission, branch protection hoặc approval rules.
10. Có automated tests cho các luồng domain/API quan trọng.

Approval và pipeline UI được xếp P1 trong baseline này; việc merge vẫn phải dựa trên quyết định cuối cùng của GitLab server.

## 10. Giới hạn phạm vi

Các chức năng sau không thuộc baseline MVP:

- Quản lý GitLab Issues, Epics và Milestones.
- Tạo hoặc quản trị repository/project.
- Thực hiện commit, push, rebase hoặc cherry-pick.
- Cấu hình/chạy pipeline.
- AI-powered code review hoặc tự động sửa code.
- Tích hợp GitHub, Bitbucket hoặc nền tảng SCM khác.
- Bypass protected branch hoặc approval policy.

## 11. Truy vết yêu cầu

Mỗi requirement ID trong tài liệu này PHẢI được liên kết tới:
1. Design component hoặc module chịu trách nhiệm.
2. Implementation task/issue.
3. Test case hoặc phương pháp xác minh.
4. Trạng thái: Proposed, Approved, Implemented, Verified hoặc Deferred.

Các nhóm ID chính:

| Nhóm | Phạm vi |
|---|---|
| UI | User interface |
| IF / COM | External software and communication interfaces |
| AUTH | Authentication |
| PROJ | Project/workspace |
| MR / DETAIL | Merge Request discovery and details |
| DIFF | Diff and code review |
| DISC | Comments and discussions |
| APR | Approval |
| PIPE | Pipeline |
| MERGE | Merge operations |
| BR | Business rules |
| DATA | Data handling |
| NFR | Non-functional requirements |
| ERR | Error handling |

## 12. Các quyết định còn mở

Các mục sau PHẢI được Product Owner xác nhận trước khi chốt baseline implementation:

| ID | Quyết định | Phương án cần chọn | Đề xuất |
|---|---|---|---|
| DEC-001 | Authentication | PAT, OAuth 2.0 hoặc cả hai | PAT cho MVP; thiết kế abstraction để có thể bổ sung OAuth |
| DEC-002 | UI architecture | Native, Webview hoặc hybrid | Hybrid, ưu tiên native VS Code UI |
| DEC-003 | Inline comment | MVP hoặc phase sau | MVP |
| DEC-004 | Project discovery | Auto-detect, manual hoặc cả hai | Cả hai |
| DEC-005 | Minimum GitLab version | Chọn phiên bản Self-Managed thấp nhất hỗ trợ | Chốt sau khi kiểm chứng endpoint diff/discussion |
| DEC-006 | Multi-project | Một project active hay nhiều project đồng thời | Một active project trước; mở rộng sau |
| DEC-007 | Review decision | Comment-only hay thêm approve/request changes | Comment/reply trong MVP; approval action P1 |
| DEC-008 | Pipeline và approval UI | MVP hay P1 | P1 |
| DEC-009 | Merge options | Squash, merge-when-pipeline-succeeds | Chỉ hỗ trợ option người dùng chọn rõ ràng |
| DEC-010 | Localization | English-only hay English + Vietnamese | English UI ban đầu; tài liệu có thể song ngữ |

## Phụ lục A — Phân kỳ triển khai dự kiến

Phân kỳ này chỉ nhằm định hướng lập kế hoạch, không thay thế requirement và không phải cam kết lịch phát hành.

| Phase | Phạm vi |
|---|---|
| 0 — Requirements baseline | Chốt DEC items, GitLab compatibility và UX direction |
| 1 — Foundation | Extension skeleton, authentication, project mapping, API client |
| 2 — MR management | Tree views, MR list, filter, pagination, detail |
| 3 — Review | Diff, general comment, inline comment, discussion/reply |
| 4 — Merge readiness | Pipeline/approval views, merge validation và merge action |
| 5 — Release readiness | Compatibility, accessibility, tests, packaging và documentation |

## Phụ lục B — Definition of Done

Một requirement chỉ được đánh dấu Verified khi:
- Acceptance condition của requirement đã được xác định.
- Implementation đáp ứng requirement đã được Approved.
- Có test hoặc bằng chứng xác minh phù hợp.
- Loading, empty, error và permission states liên quan đã được xử lý.
- Không để lộ credential hoặc dữ liệu nhạy cảm.
- Tài liệu liên quan được cập nhật.
- Không có regression trong các luồng chức năng hiện có.

---

**Trạng thái tài liệu:** Draft. Các yêu cầu có mã ID là baseline đề xuất để review; các quyết định ở Mục 12 vẫn cần Product Owner xác nhận. Tài liệu này không hàm ý rằng implementation đã bắt đầu.
