# ReviewDock — Software Requirements Specification (SRS)

> **Mã tài liệu:** RVD-SRS-001  
> **Sản phẩm:** ReviewDock  
> **Loại tài liệu:** Software Requirements Specification  
> **Phiên bản:** 1.0.5-draft  
> **Trạng thái:** Draft — chờ Product Owner xác nhận  
> **Repository:** [minh-lb/vscode-reviewdock](https://github.com/minh-lb/vscode-reviewdock)  
> **Ngày:** 2026-11-17

---

## Kiểm soát tài liệu

| Thuộc tính | Giá trị |
|---|---|
| Document ID | RVD-SRS-001 |
| Version | 1.0.5-draft |
| Product | ReviewDock |
| Target platform | Visual Studio Code Extension |
| Primary integration | GitHub REST API v3 + GitLab REST API v4 |
| Document owner | Project maintainer |
| Implementation status | Not started |

### Lịch sử phiên bản

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 0.1.0 | 2026-11-16 | Bản yêu cầu sản phẩm ban đầu |
| 1.0.0-draft | 2026-11-16 | Chuẩn hóa thành SRS |
| 1.0.1-draft | 2026-11-16 | Đồng bộ scope inline comment MVP và liên kết bộ tài liệu thiết kế/kiểm thử |
| 1.0.2-draft | 2026-11-16 | Mở rộng sang GitHub + GitLab và đặc tả multi-connection |
| 1.0.3-draft | 2026-11-16 | Bổ sung trạng thái cấu hình Enabled/Disabled độc lập với connection health |
| 1.0.4-draft | 2026-11-16 | Chuẩn hóa provider semantics, GitHub/GitLab API differences, compatibility policy và requirement traceability |
| 1.0.5-draft | 2026-11-17 | Bổ sung Rich diff cho Markdown và trạng thái Source/Rich độc lập theo từng file |

## 1. Giới thiệu

### 1.1. Mục đích

Tài liệu này xác định các yêu cầu phần mềm cho ReviewDock — extension của Visual Studio Code dùng để quản lý GitHub Pull Request (PR) và GitLab Merge Request (MR), đồng thời thực hiện code review trong IDE.

SRS là cơ sở để:
- Thiết kế kiến trúc và giao diện.
- Chia nhỏ công việc phát triển.
- Xây dựng test cases.
- Đánh giá mức độ hoàn thành theo từng requirement.
- Kiểm soát thay đổi phạm vi trước và trong quá trình triển khai.

Tài liệu mô tả **phần mềm cần làm gì và các điều kiện cần đáp ứng**, không quy định chi tiết implementation ở cấp class, function hoặc file source.

### 1.2. Phạm vi sản phẩm

ReviewDock cung cấp giao diện trong VS Code để người dùng:
1. Tạo và quản lý nhiều connection GitHub/GitLab, bao gồm nhiều account trên cùng một server.
2. Đặt tên, kiểm tra, chọn default, đổi account, disconnect và xóa từng connection độc lập.
3. Chọn hoặc nhận diện repository/project từ Git remote của từng workspace folder.
4. Tìm, lọc và xem GitHub Pull Request hoặc GitLab Merge Request.
5. Đọc thay đổi code trong diff viewer.
6. Xem và tham gia review comments/discussions.
7. Tạo comment chung, inline comment và reply theo capability của provider.
8. Theo dõi GitHub Checks/Actions hoặc GitLab Pipelines và approval/review state khi provider hỗ trợ.
9. Merge PR/MR khi người dùng có quyền và provider server cho phép.

GitHub/GitLab server tương ứng là nguồn dữ liệu có thẩm quyền. ReviewDock không thay thế cơ chế authorization, branch protection, repository rules, approval rules, merge checks hoặc chính sách của repository/project.

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
- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub Pull Requests API](https://docs.github.com/en/rest/pulls/pulls)
- [GitHub Pull Request Review Comments API](https://docs.github.com/en/rest/pulls/comments)
- [GitHub Search Issues and Pull Requests](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [GitLab REST API](https://docs.gitlab.com/api/rest/)
- [GitLab Merge Requests API](https://docs.gitlab.com/api/merge_requests/)
- [GitLab Notes API](https://docs.gitlab.com/api/notes/)
- [GitLab Discussions API](https://docs.gitlab.com/api/discussions/)
- [GitLab Merge Request Approvals API](https://docs.gitlab.com/api/merge_request_approvals/)
- [GitLab Jobs API](https://docs.gitlab.com/api/jobs/)

Tài liệu thiết kế và triển khai liên quan: [DECISIONS.md](./DECISIONS.md), [CONNECTION-MANAGEMENT.md](./CONNECTION-MANAGEMENT.md), [SDS.md](./SDS.md), [API-SPEC.md](./API-SPEC.md), [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md), [UI-UX.md](./UI-UX.md), [TEST-PLAN.md](./TEST-PLAN.md), [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md), [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md), [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md).

Các endpoint, field và capability cụ thể phải được đối chiếu với phiên bản GitHub/GitLab được công bố trong [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md) trước khi implementation và release.

## 2. Mô tả tổng thể

### 2.1. Bối cảnh hệ thống

ReviewDock là một VS Code extension chạy trong Extension Host. Extension giao tiếp trực tiếp với GitHub hoặc GitLab server do người dùng cấu hình thông qua HTTPS và provider REST API.

ReviewDock không yêu cầu backend riêng trong MVP. Người dùng có thể cấu hình nhiều connection độc lập; metadata connection được lưu trong VS Code state và credential của từng connection được lưu riêng bằng SecretStorage.

### 2.2. Chức năng tổng quát

| Nhóm | Chức năng |
|---|---|
| Connection | Quản lý nhiều GitHub/GitLab connections và credential độc lập |
| Repository | Nhận diện Git remote, chọn repository/project và gán connection |
| Review request discovery | Danh sách, tìm kiếm, lọc và phân trang GitHub PR / GitLab MR |
| Review request detail | Metadata, trạng thái, branch, reviewer và mô tả |
| Code review | Danh sách file thay đổi, diff và điều hướng |
| Comments / Discussions | Comment chung, inline review comment, thread và reply theo provider |
| Approval / Review | Xem approval/review state; thao tác nếu provider hỗ trợ và được phép |
| Checks / Pipeline | Xem GitHub Checks/Actions hoặc GitLab Pipelines/Jobs |
| Merge | Kiểm tra trạng thái, xác nhận và yêu cầu provider merge |
| Settings | Quản lý connection, repository binding và tùy chọn extension |

### 2.3. Nhóm người dùng

| Actor | Mô tả | Quyền phụ thuộc |
|---|---|---|
| Developer / Author | Người tạo hoặc đóng góp vào PR/MR | Quyền của tài khoản trên provider |
| Reviewer | Người được yêu cầu review hoặc được assign | Quyền đọc và review trên repository/project |
| Maintainer | Người quản lý repository/project và quy trình merge | Quyền và branch/repository policy |
| GitHub / GitLab Server | Hệ thống ngoài cung cấp API và thực thi policy | Provider, phiên bản, cấu hình và trạng thái server |
| VS Code | Host chạy extension và cung cấp UI/storage APIs | Phiên bản VS Code tương thích |

ReviewDock PHẢI phản ánh quyền mà provider API cấp; không tự cấp thêm quyền cho bất kỳ actor nào.

### 2.4. Môi trường vận hành

- Visual Studio Code Stable trên Windows, macOS và Linux.
- GitHub.com và GitHub Enterprise Server trong phạm vi phiên bản được công bố.
- GitLab.com và GitLab Self-Managed trong phạm vi phiên bản được công bố.
- Kết nối mạng tới GitHub/GitLab API host qua HTTPS.
- Workspace có thể chứa một hoặc nhiều Git repository.

Minimum VS Code engine version và chính sách GitHub Enterprise Server/GitLab Self-Managed compatibility được đề xuất tại DECISIONS.md và phải được phê duyệt trước khi M0 khóa package manifest.

### 2.5. Ràng buộc thiết kế

- Sản phẩm PHẢI được phát hành dưới dạng VS Code extension.
- Ngôn ngữ triển khai dự kiến là TypeScript.
- Provider integration PHẢI dùng API được GitHub/GitLab công bố; không scrape giao diện Web.
- Mỗi connection PHẢI có provider, display name, server URL và account identity riêng.
- Secret PHẢI được lưu bằng VS Code SecretStorage với key theo immutable connection ID.
- UI PHẢI tuân thủ lifecycle và security model của VS Code Extension API.
- Không có thao tác nào được bypass provider authorization, repository rules, protected branches, approval rules hoặc merge policy.

### 2.6. Giả định và phụ thuộc

- Người dùng có GitHub/GitLab account và quyền truy cập repository/project tương ứng.
- Provider server cho phép API access và token được cấp đủ permission/scope.
- Các API cần thiết tồn tại trong phiên bản GitHub/GitLab được hỗ trợ.
- Một workspace có thể chứa nhiều repository và mỗi repository có thể dùng connection khác nhau.
- VS Code SecretStorage khả dụng trong môi trường vận hành.
- Trạng thái PR/MR có thể thay đổi bởi người dùng khác trong lúc ReviewDock đang mở; do đó dữ liệu hiển thị có thể stale.

## 3. Yêu cầu giao diện ngoài

### 3.1. Giao diện người dùng

**UI-001 (P0):** Extension PHẢI cung cấp entry point có tên ReviewDock trong Activity Bar hoặc vị trí điều hướng tương đương của VS Code.

**UI-002 (P0):** Extension PHẢI cung cấp view hiển thị repository/project đang chọn và các nhóm Pull Request/Merge Request.

**UI-003 (P0):** Người dùng PHẢI có thể mở PR/MR detail từ danh sách review requests.

**UI-004 (P0):** PR/MR detail PHẢI cung cấp điều hướng tới Overview, Changes và Conversations.

**UI-005 (P1):** PR/MR detail NÊN cung cấp khu vực riêng cho Checks/Pipeline và Review/Approvals.

**UI-006 (P0):** Các view PHẢI có trạng thái Loading, Empty, Error, Authentication Required và Permission Denied phù hợp.

**UI-007 (P0):** Các thao tác ghi PHẢI có trạng thái đang xử lý, ngăn submit lặp trong cùng thao tác và thông báo kết quả.

**UI-008 (P0):** Các thao tác quan trọng PHẢI dùng label/confirmation đủ rõ; không chỉ dựa vào màu hoặc icon.

**UI-009 (P0):** Các view và thao tác chính PHẢI hỗ trợ keyboard navigation theo quy ước VS Code.

**UI-010 (P1):** Extension NÊN sử dụng theme colors và accessibility conventions của VS Code.

### 3.2. Giao diện phần mềm

**IF-001 (P0):** Extension PHẢI sử dụng VS Code Extension API cho activation, commands, views, editor integration và secret storage.

**IF-002 (P0):** Extension PHẢI giao tiếp với GitHub REST API v3 hoặc GitLab REST API v4 tương ứng với provider đã chọn, qua HTTPS.

**IF-003 (P0):** Extension PHẢI đọc Git remote từ workspace thông qua cơ chế phù hợp của VS Code/Git để đề xuất project mapping.

**IF-004 (P0):** Extension KHÔNG ĐƯỢC yêu cầu người dùng cài một backend service riêng để sử dụng các chức năng MVP.

**IF-005 (P0):** UI layer KHÔNG ĐƯỢC gọi GitHub/GitLab HTTP API trực tiếp; request phải đi qua application service và provider adapter.

### 3.3. Giao diện truyền thông

**COM-001 (P0):** Request tới GitHub/GitLab PHẢI dùng HTTPS.

**COM-002 (P0):** Request và response PHẢI được parse/validate theo contract riêng của GitHub hoặc GitLab; không dùng chung DTO giả định.

**COM-003 (P0):** Client PHẢI hỗ trợ pagination theo response/header/API contract của provider đang được gọi.

**COM-004 (P0):** Client PHẢI xử lý rate limit và HTTP status codes mà không làm crash extension.

**COM-005 (P0):** Client KHÔNG ĐƯỢC ghi access token hoặc Authorization header vào log.

## 4. Yêu cầu chức năng

### 4.1. Connections và xác thực đa provider

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| AUTH-001 | P0 | Hệ thống PHẢI hỗ trợ provider type GitHub và GitLab. |
| AUTH-002 | P0 | Hệ thống PHẢI cho phép tạo nhiều connection; không giới hạn một connection toàn cục. |
| AUTH-003 | P0 | Mỗi connection PHẢI có display name do người dùng đặt. |
| AUTH-004 | P0 | Mỗi connection PHẢI xác định provider và server URL; hỗ trợ GitHub.com, GitHub Enterprise Server, GitLab.com và GitLab Self-Managed trong compatibility matrix. |
| AUTH-005 | P0 | Hệ thống PHẢI cho phép nhiều connection cùng provider/server nhưng khác account. |
| AUTH-006 | P0 | Hệ thống PHẢI xác thực bằng phương thức được duyệt cho provider; đề xuất MVP là PAT cho cả hai provider. |
| AUTH-007 | P0 | Hệ thống PHẢI lưu credential riêng trong VS Code SecretStorage, key theo immutable connection ID. |
| AUTH-008 | P0 | Hệ thống PHẢI validate credential bằng authenticated-user endpoint của provider và hiển thị account identity. |
| AUTH-009 | P0 | Người dùng PHẢI có thể test, rename, re-authenticate, disconnect và delete từng connection độc lập. |
| AUTH-010 | P0 | Hệ thống PHẢI hỗ trợ một default connection cho mỗi provider; workspace binding được ưu tiên hơn default. |
| AUTH-011 | P0 | Hệ thống PHẢI hiển thị status Connected, Re-authentication required, Unreachable, Configuration error hoặc Disconnected. |
| AUTH-012 | P0 | Hệ thống KHÔNG ĐƯỢC lưu credential trong settings.json, workspace file, source code hoặc Webview state. |
| AUTH-013 | P0 | Hệ thống KHÔNG ĐƯỢC gửi credential của connection tới provider/server khác với connection đã chọn. |
| AUTH-014 | P0 | Nếu provider + server + account identity đã tồn tại, hệ thống NÊN cảnh báo duplicate nhưng vẫn cho phép nhiều account khác nhau trên cùng server. |
| AUTH-015 | P0 | Mỗi connection PHẢI có thuộc tính cấu hình enabled độc lập với status; connection mới mặc định enabled. |
| AUTH-016 | P0 | Người dùng PHẢI có thể enable/disable từng connection độc lập mà không cần xóa hoặc tạo lại connection. |
| AUTH-017 | P0 | Connection disabled KHÔNG ĐƯỢC dùng để chọn active connection, remote discovery, default resolution hoặc gửi bất kỳ provider API request nào. |
| AUTH-018 | P0 | Disable PHẢI giữ nguyên credential, cấu hình, last-known status và workspace binding; không tự động chuyển binding sang connection khác. |
| AUTH-019 | P0 | Enable lại KHÔNG ĐƯỢC mặc định coi credential đã hợp lệ hoặc tự động validate; trạng thái xác thực hiện có tiếp tục quyết định khả năng sử dụng. |

### 4.2. Repository và workspace binding

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| PROJ-001 | P0 | Người dùng PHẢI có thể chọn GitHub repository hoặc GitLab project mà connection hiện tại có quyền truy cập. |
| PROJ-002 | P0 | Hệ thống PHẢI đọc Git remote để nhận diện provider/server/repository path và đề xuất binding tương ứng. |
| PROJ-003 | P0 | Người dùng PHẢI có thể tìm/chọn repository hoặc project thủ công. |
| PROJ-004 | P0 | Mỗi workspace folder/repository PHẢI lưu connection ID và repository/project ID đang active. |
| PROJ-005 | P0 | Nhiều workspace folder/repository CÓ THỂ sử dụng các connection khác nhau, kể cả khác provider. |
| PROJ-006 | P0 | Nếu nhiều connection cùng host/account candidates có thể truy cập remote, hệ thống PHẢI yêu cầu người dùng chọn account; không suy đoán theo hostname. |
| PROJ-007 | P0 | Hệ thống PHẢI hiển thị provider, connection name, account và repository/project đang active. |
| PROJ-008 | P0 | Khi connection bị xóa hoặc mất credential, repository binding PHẢI được đánh dấu unresolved; không tự gán sang connection khác. |
| PROJ-009 | P0 | Hệ thống KHÔNG ĐƯỢC gửi repository URL hoặc workspace metadata tới dịch vụ bên thứ ba. |

### 4.3. Danh sách và tìm kiếm Merge Request

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| MR-001 | P0 | Hệ thống PHẢI hiển thị Pull Request/Merge Request thuộc repository/project đang active. |
| MR-002 | P0 | Hệ thống PHẢI hỗ trợ lọc PR/MR theo trạng thái Open, Closed và Merged tương ứng với provider; với GitHub, Merged là tập con của API state=closed và phải được phân biệt bằng merged_at/merged, không được coi mọi closed PR là merged. |
| MR-003 | P0 | Hệ thống PHẢI cung cấp Created by me, Assigned to me và Review requested from me bằng cơ chế query native của từng provider; GitHub dùng Search Issues API, GitLab dùng MR list scopes. Team review requests chỉ được bao gồm khi được triển khai và kiểm thử riêng. |
| MR-004 | P0 | Người dùng PHẢI có thể tìm PR/MR theo provider-native number/IID hoặc title. |
| MR-005 | P0 | Danh sách MR PHẢI hỗ trợ pagination hoặc tải thêm. |
| MR-006 | P0 | Mỗi item PR/MR PHẢI hiển thị tối thiểu title, provider-native number/IID, author, source branch, target branch, state và updated time. |
| MR-007 | P0 | Item MR NÊN hiển thị draft state, reviewer/assignee, labels và trạng thái mergeability khi API cung cấp. |
| MR-008 | P0 | Người dùng PHẢI có thể refresh danh sách MR. |
| MR-009 | P0 | Sau một mutation thành công, dữ liệu MR liên quan PHẢI được refresh hoặc đánh dấu stale. |
| MR-010 | P1 | Người dùng CÓ THỂ mở PR/MR tương ứng trên provider Web. |
| MR-011 | P0 | Khi GitHub Search API đạt giới hạn 1.000 kết quả hoặc rate limit, hệ thống PHẢI thể hiện kết quả bị giới hạn; KHÔNG ĐƯỢC tuyên bố danh sách là đầy đủ. |

### 4.4. Chi tiết Merge Request

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| DETAIL-001 | P0 | Hệ thống PHẢI hiển thị title, provider-native PR number/MR IID, description, author, state và timestamps. |
| DETAIL-002 | P0 | Hệ thống PHẢI hiển thị source branch và target branch. |
| DETAIL-003 | P0 | Hệ thống PHẢI hiển thị assignees, reviewers và labels khi API cung cấp. |
| DETAIL-004 | P0 | Hệ thống PHẢI hiển thị số commit, số file thay đổi, additions và deletions khi provider API cung cấp. |
| DETAIL-005 | P0 | Hệ thống PHẢI cho phép người dùng refresh PR/MR detail. |
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
| DIFF-007 | P0 | Hệ thống PHẢI hỗ trợ tạo inline comment trên một dòng hợp lệ của diff. |
| DIFF-012 | P1 | Hệ thống NÊN hỗ trợ inline comment trên một đoạn nhiều dòng sau khi line-range mapping được kiểm chứng. |
| DIFF-008 | P0 | Hệ thống PHẢI hiển thị review comment/discussion tại vị trí code tương ứng bằng position metadata của provider khi API cung cấp. |
| DIFF-009 | P0 | Hệ thống PHẢI xử lý file binary, diff quá lớn, patch không khả dụng hoặc file không có diff text bằng trạng thái/giải thích phù hợp. |
| DIFF-010 | P0 | Khi diff version thay đổi hoặc position không còn hợp lệ, hệ thống PHẢI yêu cầu refresh diff trước khi gửi inline comment. |
| DIFF-011 | P1 | Hệ thống NÊN hỗ trợ mở file tương ứng trong working tree khi xác định được mapping an toàn. |
| DIFF-013 | P1 | Với file Markdown có patch hợp lệ, hệ thống NÊN hỗ trợ chuyển giữa Source (unified diff) và Rich diff; trạng thái mode PHẢI độc lập theo từng file và được giữ khi điều hướng trong cùng PR/MR. |

**Quy tắc vị trí inline comment:** client PHẢI dùng position contract riêng của provider. GitLab yêu cầu diff-version SHAs, old/new paths và old/new line fields; GitHub yêu cầu current PR head commit SHA, path, diff line và side. Client KHÔNG ĐƯỢC tự chuyển một inline comment thất bại thành comment chung.

### 4.6. Comments và discussions

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| DISC-001 | P0 | Hệ thống PHẢI tải và hiển thị conversation resources của PR/MR: GitHub issue comments, inline review comments và review submissions; GitLab discussions/notes. |
| DISC-002 | P0 | Người dùng PHẢI có thể tạo general comment cho PR/MR bằng resource type phù hợp của provider. |
| DISC-003 | P0 | Người dùng PHẢI có thể tạo inline comment trên diff hợp lệ. |
| DISC-004 | P0 | Người dùng PHẢI có thể reply vào thread khi provider capability cho phép: GitLab discussion notes hỗ trợ reply; GitHub chỉ hỗ trợ reply vào top-level inline review comment và không hỗ trợ reply vào general issue comment hoặc reply lồng nhau trong workflow REST đã chọn. |
| DISC-005 | P0 | Comment PHẢI hiển thị author, nội dung và timestamp. |
| DISC-006 | P0 | Conversation PHẢI thể hiện trạng thái resolved/unresolved khi provider API cung cấp; trạng thái không áp dụng hoặc không được hỗ trợ phải được phân biệt với unknown. |
| DISC-007 | P1 | Người dùng CÓ THỂ resolve/reopen discussion nếu provider API và quyền tài khoản cho phép; GitHub REST adapter hiện tại không cung cấp capability này. |
| DISC-008 | P1 | Người dùng CÓ THỂ edit/delete comment của chính mình nếu provider API và quyền tài khoản cho phép. |
| DISC-009 | P0 | Hệ thống PHẢI ngăn submit lặp trong khi request gửi comment đang chạy. |
| DISC-010 | P0 | Nếu request tạo comment timeout và kết quả không xác định, hệ thống PHẢI refresh các conversation resources liên quan trước khi cho phép người dùng retry; không tự retry mutation một cách mù quáng. |
| DISC-011 | P0 | Hệ thống PHẢI hiển thị lỗi của provider khi comment/reply bị từ chối do permission, validation, diff position hoặc trạng thái PR/MR. |
| DISC-012 | P0 | Hệ thống PHẢI bảo toàn loại resource, provider-native ID, parent/thread ID và system-note metadata; không đánh đồng GitHub issue comment, inline review comment, review submission và GitLab discussion note. |
| DISC-013 | P0 | UI PHẢI chỉ cung cấp reply/resolve/edit/delete action khi capability descriptor của provider và loại conversation hiện tại cho phép. |

### 4.7. Approval và review decision

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| APR-001 | P1 | Hệ thống NÊN hiển thị GitHub review decision và GitLab approval state; chỉ hiển thị approval rules/count khi provider/edition trả về các trường đó. |
| APR-002 | P1 | Hệ thống NÊN hiển thị danh sách người đã approve/review và trạng thái tương ứng khi provider API cung cấp. |
| APR-003 | P1 | Hệ thống CÓ THỂ cho phép GitHub submit APPROVE/REQUEST_CHANGES hoặc GitLab approve/unapprove khi provider API và quyền cho phép. |
| APR-004 | P0 | Hệ thống PHẢI phân biệt comment với approval; tạo comment không được xem là approve. |
| APR-005 | P0 | Hệ thống KHÔNG ĐƯỢC tự kết luận PR/MR đủ approval nếu provider không xác nhận; thiếu field phải được coi là unknown/unavailable. |

### 4.8. Pipeline và jobs

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| PIPE-001 | P1 | Hệ thống NÊN hiển thị GitHub Checks/Actions hoặc GitLab pipeline mới nhất liên quan tới PR/MR head commit. |
| PIPE-002 | P1 | Hệ thống NÊN hiển thị trạng thái checks/pipeline theo dữ liệu provider trả về. |
| PIPE-003 | P1 | Hệ thống NÊN hiển thị job/check run và thông tin cơ bản của lần chạy thất bại khi API cho phép. |
| PIPE-004 | P1 | Người dùng CÓ THỂ mở check, workflow run, pipeline hoặc job trên provider Web. |
| PIPE-005 | P0 | Hệ thống KHÔNG ĐƯỢC hiển thị dữ liệu cache như trạng thái pipeline hiện tại nếu chưa xác minh freshness. |

### 4.9. Merge operation

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| MERGE-001 | P0 | Hệ thống PHẢI hiển thị trạng thái mergeability do provider cung cấp, hoặc unknown nếu provider chưa xác định. |
| MERGE-002 | P0 | Hệ thống PHẢI chỉ cho phép bắt đầu thao tác merge với PR/MR đang mở và không bị client xác định chắc chắn là đã đóng/đã merge; provider server là nơi quyết định cuối cùng về quyền và merge eligibility. |
| MERGE-003 | P0 | Hệ thống PHẢI yêu cầu xác nhận rõ ràng trước khi gửi merge request. |
| MERGE-004 | P0 | Trước khi merge, hệ thống PHẢI refresh dữ liệu cần thiết và gửi expected source/head SHA nếu provider endpoint hỗ trợ. |
| MERGE-005 | P1 | Hệ thống NÊN hỗ trợ squash hoặc merge options theo cấu hình project và API. |
| MERGE-006 | P0 | Hệ thống PHẢI hiển thị kết quả merge từ provider và refresh trạng thái PR/MR sau thao tác. |
| MERGE-007 | P0 | Hệ thống PHẢI xử lý merge conflict, missing approval, pipeline failure, SHA mismatch và permission denied. |
| MERGE-008 | P0 | Hệ thống KHÔNG ĐƯỢC bypass protected branch, repository rules, approval rules, merge checks hoặc quyền provider. |
| MERGE-009 | P0 | Hệ thống KHÔNG ĐƯỢC tự bật auto-merge, merge queue hoặc merge-when-pipeline-succeeds nếu người dùng chưa chọn rõ ràng; các chức năng này ngoài MVP. |
| MERGE-010 | P0 | Hệ thống KHÔNG ĐƯỢC tự retry merge request khi kết quả request trước đó không xác định; phải refresh trạng thái PR/MR trước. |

## 5. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-001 | GitHub/GitLab server tương ứng là nguồn dữ liệu có thẩm quyền cho trạng thái PR/MR, checks/pipeline, review/approval và kết quả merge. |
| BR-002 | Quyền thao tác phụ thuộc vào credential của connection đang chọn và quyền repository/project trên provider. |
| BR-003 | Comment chung, inline comment, reply, resolve và approval là các hành động khác nhau; UI không được đánh đồng. |
| BR-004 | Inline comment chỉ hợp lệ khi vị trí gắn với current PR/MR head hoặc diff version mà provider chấp nhận. |
| BR-005 | Client-side merge eligibility chỉ là thông tin hỗ trợ; quyết định cuối cùng thuộc provider server. |
| BR-006 | Dữ liệu cache có thể cũ; thao tác ghi quan trọng phải refresh trạng thái cần thiết trước khi thực hiện. |
| BR-007 | Không có thao tác ghi nào được thực hiện ngầm hoặc chỉ dựa trên việc mở một PR/MR. |
| BR-008 | Không được dùng ReviewDock để né tránh branch protection, repository rules hoặc policy của provider. |
| BR-009 | Connection disabled bị loại khỏi mọi luồng chọn connection và request tới provider; workspace binding liên quan được giữ lại nhưng phải chặn thao tác cho đến khi người dùng enable hoặc gán connection khác. |
| BR-010 | enabled là trạng thái cấu hình do người dùng quản lý; status là trạng thái kết nối/xác thực được quan sát gần nhất. Hai thuộc tính không được ghi đè hoặc suy diễn lẫn nhau. |
| BR-011 | Conversation resource types và mutation capabilities phải giữ đúng semantics của provider; không giả lập reply hoặc resolve khi endpoint không hỗ trợ. |
| BR-012 | GitHub Search API result cap/rate limit phải được phản ánh trong UI; kết quả bị giới hạn không được gắn nhãn exhaustive. |
| BR-013 | Provider capability unknown/not-applicable phải được phân biệt với false/zero; không suy diễn approval, resolution, pipeline hoặc merge state từ field vắng mặt. |
| BR-014 | PR/MR identity và cache scope luôn bao gồm connection ID và repository/project ID; PR number hoặc MR IID không phải global identifier. |



## 6. Yêu cầu dữ liệu

### 6.1. Dữ liệu được xử lý

| Nhóm dữ liệu | Ví dụ | Xử lý |
|---|---|---|
| Connection | Provider, display name, server URL, account identity, status | Lưu cấu hình không nhạy cảm; credential lưu riêng theo connection ID |
| Repository binding | Connection ID, provider repository/project ID, full name, web URL, remote mapping | Lưu theo workspace folder/user khi cần |
| Review Request | GitHub PR number / GitLab MR IID, title, branches, state, SHA, metadata | Tải từ provider; cache tạm thời nếu cần |
| Diff | File path, patch, line positions, diff SHAs | Tải khi người dùng mở Changes |
| Review conversation | GitHub issue comments, inline review comments, reviews; GitLab discussions/notes; author, body, timestamp, position, parent/thread ID | Tải từ provider; giữ resource type và normalize theo capability |
| Checks / Pipeline | GitHub Check Runs/Actions hoặc GitLab Pipeline/Jobs | Tải khi người dùng mở khu vực checks/pipeline |
| Approval | Rules, approvals, users | Tải khi người dùng mở khu vực approval |
| Credential | PAT/OAuth secret | Chỉ lưu bằng SecretStorage |

### 6.2. Lưu trữ và vòng đời dữ liệu

**DATA-001 (P0):** Credential PHẢI được lưu tách biệt khỏi cấu hình thông thường bằng SecretStorage.

**DATA-002 (P0):** Cấu hình không nhạy cảm chỉ được lưu ở global/workspace state hoặc settings phù hợp.

**DATA-003 (P0):** Dữ liệu PR/MR, diff và conversation mặc định NÊN được giữ trong bộ nhớ; persistent cache phải có quyết định riêng.

**DATA-004 (P0):** Khi disconnect, hệ thống PHẢI xóa credential của đúng connection khỏi SecretStorage; các connection khác không bị ảnh hưởng.

**DATA-005 (P0):** Hệ thống KHÔNG ĐƯỢC ghi token, private diff hoặc comment content vào diagnostic log.

**DATA-006 (P0):** Cache key PHẢI bao gồm connection ID, provider, server URL, repository/project ID và review request ID để cô lập dữ liệu giữa các account/host.

**DATA-007 (P0):** Thuộc tính enabled PHẢI được lưu trong connection registry không nhạy cảm; không lưu chung với credential và không được suy ra từ status.

## 7. Yêu cầu phi chức năng

### 7.1. Hiệu năng

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-PERF-001 | P0 | Extension activation KHÔNG ĐƯỢC chờ hoàn thành request mạng tới GitHub hoặc GitLab. |
| NFR-PERF-002 | P0 | Khi người dùng kích hoạt một view cần dữ liệu mạng, UI PHẢI hiển thị loading state trước khi request hoàn tất. |
| NFR-PERF-003 | P0 | Danh sách PR/MR PHẢI dùng pagination; diff và conversations chỉ tải khi cần. |
| NFR-PERF-004 | P0 | Network request PHẢI hỗ trợ timeout và cancellation khi view/context không còn cần kết quả. |
| NFR-PERF-005 | P0 | Các thao tác UI cục bộ không được đồng bộ chờ network trên extension event loop. |

### 7.2. Bảo mật và quyền riêng tư

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-SEC-001 | P0 | Token PHẢI được lưu bằng SecretStorage. |
| NFR-SEC-002 | P0 | Token KHÔNG ĐƯỢC xuất hiện trong log, telemetry, exception message hoặc settings. |
| NFR-SEC-003 | P0 | Credential chỉ được gửi tới API host thuộc đúng connection đã chọn; redirect/pagination sang host khác không được mang theo credential. |
| NFR-SEC-004 | P0 | Kết nối tới GitHub/GitLab PHẢI dùng HTTPS và xác minh TLS theo trust store của môi trường. |
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
| NFR-COMP-002 | P0 | Extension PHẢI hỗ trợ GitHub.com và GitLab.com. |
| NFR-COMP-003 | P0 | Extension PHẢI hỗ trợ GitHub Enterprise Server và GitLab Self-Managed trong phạm vi phiên bản đã công bố. |
| NFR-COMP-004 | P0 | Minimum VS Code engine version, GitHub Enterprise Server target và GitLab Self-Managed compatibility window PHẢI được công bố trước release MVP. |
| NFR-COMP-005 | P0 | Release PHẢI công bố chính xác các phiên bản VS Code/GHES/GitLab đã kiểm thử và cập nhật compatibility matrix theo vòng đời hỗ trợ của vendor. |

### 7.5. Khả năng bảo trì và kiểm thử

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-MAIN-001 | P0 | Codebase PHẢI sử dụng TypeScript strict mode. |
| NFR-MAIN-002 | P0 | Domain/business logic PHẢI tách khỏi VS Code UI và provider-specific HTTP transport đủ để unit test. |
| NFR-MAIN-003 | P0 | GitHub/GitLab response PHẢI được validate/map qua provider adapter trước khi sử dụng trong domain/UI. |
| NFR-MAIN-004 | P0 | Các module API quan trọng PHẢI có unit/integration tests. |
| NFR-MAIN-005 | P0 | Lỗi log phải hữu ích cho chẩn đoán nhưng không chứa secret hoặc dữ liệu nhạy cảm. |
| NFR-MAIN-006 | P0 | Mỗi provider adapter PHẢI có contract tests cho request routing, DTO mapping, pagination, error mapping và mutation semantics. |

### 7.6. Khả năng sử dụng và accessibility

| ID | Ưu tiên | Yêu cầu |
|---|---|---|
| NFR-UX-001 | P0 | Người dùng PHẢI thực hiện được các workflow chính bằng keyboard. |
| NFR-UX-002 | P0 | Trạng thái không được chỉ biểu đạt bằng màu sắc. |
| NFR-UX-003 | P0 | Action có tác động dữ liệu PHẢI có tên và kết quả dễ hiểu. |
| NFR-UX-004 | P1 | Extension NÊN hỗ trợ VS Code theme và accessibility labels. |
| NFR-UX-005 | P0 | UI PHẢI hiển thị provider-native terminology và chỉ hiển thị action được capability descriptor hỗ trợ; không được dùng một action label cho hai semantics khác nhau. |

## 8. Xử lý lỗi

| Mã | Điều kiện | Hành vi bắt buộc |
|---|---|---|
| ERR-001 | Token invalid/expired/revoked | Báo kết nối không hợp lệ; hướng dẫn reconnect; không retry liên tục. Với provider/endpoint có thể dùng 401 cho operation-level permission, phải kiểm tra authenticated-user endpoint trước khi yêu cầu đổi token. |
| ERR-002 | HTTP 403 | Báo không đủ quyền; không đề xuất bypass |
| ERR-003 | HTTP 404 | Báo repository/project/PR/MR/resource không còn khả dụng |
| ERR-004 | HTTP 400/422 | Hiển thị validation error có thể hành động |
| ERR-005 | HTTP 429 | Tôn trọng rate limit/retry guidance của provider |
| ERR-006 | Timeout/network failure | Báo lỗi kết nối; cho phép refresh/retry an toàn |
| ERR-007 | Stale diff position | Bắt buộc reload diff trước khi tạo inline comment |
| ERR-008 | Merge conflict / policy rejection | Hiển thị trạng thái và thông tin provider trả về; không giả lập merge thành công |
| ERR-009 | SHA mismatch | Refresh PR/MR và yêu cầu người dùng thực hiện lại thao tác có xác nhận |
| ERR-010 | Provider API capability/version không tương thích | Thông báo chức năng không được hỗ trợ trên server đó |

## 9. Yêu cầu kiểm thử và xác minh

### 9.1. Phương pháp xác minh

Mỗi requirement phải được xác minh bằng một hoặc nhiều phương pháp:

- **Test:** unit, integration hoặc end-to-end test.
- **Inspection:** kiểm tra source, cấu hình, log hoặc tài liệu.
- **Demonstration:** thực hiện workflow trên VS Code và GitHub/GitLab test repositories/projects.
- **Analysis:** phân tích API contract, security behavior hoặc performance.

### 9.2. Ma trận xác minh tối thiểu

| Phạm vi | Kịch bản xác minh | Kết quả mong đợi |
|---|---|---|
| Authentication | Token hợp lệ/không hợp lệ; disconnect | Kết nối đúng trạng thái; secret không lộ |
| Project | Remote match và remote không match | Đề xuất đúng hoặc cho phép chọn thủ công |
| PR/MR list | Filter, search, pagination và giới hạn Search API | Kết quả khớp provider; kết quả bị giới hạn được báo rõ |
| PR/MR detail | PR/MR open/closed/merged | Metadata hiển thị đúng |
| Diff | Added/modified/deleted/renamed/binary | Hiển thị đúng hoặc fallback có giải thích |
| Comment | GitHub issue comment, inline review comment/reply; GitLab discussion/reply | Resource/thread semantics và nội dung hiển thị đúng trên provider |
| Inline comment | Diff position hợp lệ và stale | Gửi đúng vị trí; stale bị từ chối an toàn |
| Approval | Có/không đủ quyền approve | Hiển thị trạng thái/quyền đúng |
| Checks/Pipeline | Pending/success/failed | Hiển thị theo dữ liệu provider và current head SHA |
| Merge | Merge success và policy rejection | Không merge khi provider từ chối; kết quả được phản ánh chính xác |
| Security | Inspect settings/log/disconnect | Không có token trong nơi không an toàn |
| Resilience | Offline, timeout, 401, 403, 429, 5xx | Extension không crash; lỗi được phân loại |

### 9.3. Điều kiện chấp nhận MVP

MVP chỉ được chấp nhận khi tất cả tiêu chí sau được xác minh:

1. Tạo và quản lý nhiều connection GitHub/GitLab; credential được cô lập an toàn.
2. Chọn/nhận diện repository/project theo connection.
3. Hiển thị PR/MR list có filter và pagination.
4. Hiển thị PR/MR detail.
5. Hiển thị diff và file changes.
6. Tạo general comment, inline comment và reply discussion.
7. Merge PR/MR khi provider cho phép và người dùng xác nhận.
8. Xử lý các lỗi authentication, permission, network, stale diff, SHA mismatch và merge rejection.
9. Không bypass provider permission, branch protection, repository rules hoặc approval rules.
10. Có automated contract/integration tests cho các luồng domain/API quan trọng trên cả hai provider.
11. UI không hiển thị reply cho GitHub general issue comment, không cho reply lồng nhau và không hiển thị resolve action cho GitHub REST adapter.
12. GitHub Search API cap/rate-limit và GitHub 3,000-file diff cap được thể hiện là partial/limited result, không phải complete result.

Approval và checks/pipeline UI được xếp P1 trong baseline này; việc merge vẫn phải dựa trên quyết định cuối cùng của GitHub/GitLab server.

## 10. Giới hạn phạm vi

Các chức năng sau không thuộc baseline MVP:

- Quản lý GitHub Issues (ngoài issue comments gắn với PR), GitLab Issues, Epics và Milestones.
- Tạo hoặc quản trị repository/project.
- Thực hiện commit, push, rebase hoặc cherry-pick.
- Cấu hình/chạy pipeline.
- AI-powered code review hoặc tự động sửa code.
- Tích hợp Bitbucket hoặc nền tảng SCM khác.
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
| AUTH | Multi-provider connection and authentication |
| PROJ | Repository/workspace binding |
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
| CONV | Provider-specific conversation semantics |

## 12. Các quyết định còn mở

Các mục sau PHẢI được Product Owner xác nhận trước khi chốt baseline implementation. Đề xuất mặc định, trade-off và checklist phê duyệt được quản lý tại [DECISIONS.md](./DECISIONS.md):

| ID | Quyết định | Phương án cần chọn | Đề xuất |
|---|---|---|---|
| DEC-001 | Authentication | PAT, OAuth 2.0 hoặc cả hai | PAT cho MVP; thiết kế abstraction để có thể bổ sung OAuth |
| DEC-002 | UI architecture | Native, Webview hoặc hybrid | Hybrid, ưu tiên native VS Code UI |
| DEC-003 | Inline comment | MVP hoặc phase sau | MVP |
| DEC-004 | Project discovery | Auto-detect, manual hoặc cả hai | Cả hai |
| DEC-005 | Provider compatibility policy | Chọn phiên bản VS Code/GHES/GitLab được hỗ trợ | Theo các phiên bản vendor-maintained tại thời điểm release; xem capability matrix |
| DEC-006 | Multi-project | Một project active hay nhiều project đồng thời | Một active project trước; mở rộng sau |
| DEC-007 | Review decision | Comment-only hay thêm approve/request changes | Comment/reply trong MVP; approval action P1 |
| DEC-008 | Pipeline và approval UI | MVP hay P1 | P1 |
| DEC-009 | Merge options | Squash, merge-when-pipeline-succeeds | Chỉ hỗ trợ option người dùng chọn rõ ràng |
| DEC-010 | Localization | English-only hay English + Vietnamese | English UI ban đầu; tài liệu có thể song ngữ |
| DEC-011 | Webview framework | React hay framework khác | React + TypeScript, bundle local |
| DEC-012 | Diff rendering | Shared model hay provider-specific renderers | Shared diff rows, separate provider line mappers |
| DEC-013 | Multi-provider architecture | Separate provider adapters hay provider-specific services toàn cục | Separate adapters behind common application contract |
| DEC-014 | Connection identity | Mutable hay immutable connection identity | Immutable UUID; provider/server immutable after creation |
| DEC-015 | Provider capability model | Shared behavior hay capability descriptor | Capability descriptor per adapter and conversation kind |
| DEC-016 | Connection enablement | Có hỗ trợ bật/tắt độc lập từng connection hay không | Có; mặc định enabled, disabled không được phát sinh API request và không tự động failover |
| DEC-017 | Review conversation semantics | Cách xử lý GitHub issue comments, inline review comments và GitLab discussions | Giữ semantics riêng; chỉ bật reply/resolve theo capability |
| DEC-018 | Review request discovery | Cách lọc/search PR/MR theo user và repository | Query native theo provider; cảnh báo giới hạn GitHub Search API |
| DEC-019 | Minimum VS Code engine | Phiên bản VS Code tối thiểu | Đề xuất 1.140.0; test minimum và current Stable trước M0 |

## Phụ lục A — Phân kỳ triển khai dự kiến

Phân kỳ này chỉ nhằm định hướng lập kế hoạch, không thay thế requirement và không phải cam kết lịch phát hành.

| Phase | Phạm vi |
|---|---|
| 0 — Requirements baseline | Chốt DEC items, provider capability/compatibility matrix và UX direction |
| 1 — Foundation | Extension skeleton, authentication, project mapping, API client |
| 2 — PR/MR management | Tree views, PR/MR list, filter, pagination, detail |
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


## 13. Provider-neutral acceptance and compatibility constraints

1. Every P0 workflow must be accepted independently on GitHub.com and GitLab.com; success on one does not imply support on the other.
2. Preserve native semantics where generic normalization loses meaning, especially general vs inline comments, discussions, approvals, checks and pipelines.
3. GHES, GitLab Self-Managed and minimum VS Code engine versions are release-blocking decisions. Vendor-maintained release windows may guide test selection, but do not establish ReviewDock compatibility. Until exact versions are selected and live-host acceptance passes, do not claim support for those versions.
4. Unsupported, not-authorized, unknown and empty states remain distinct.
5. Requirement-to-design/task/test mapping is maintained in [REQUIREMENT-TRACEABILITY.md](./REQUIREMENT-TRACEABILITY.md).
6. Provider differences and compatibility evidence are maintained in [PROVIDER-CAPABILITY-MATRIX.md](./PROVIDER-CAPABILITY-MATRIX.md).


## 14. Additional release decisions

The following decisions supplement Section 12 and must be resolved before the corresponding release claims are made:

| ID | Decision | Required evidence |
|---|---|---|
| DEC-020 | Minimum GitHub Enterprise Server | Tested auth, PR, diff, review comment and merge on selected version |
| DEC-021 | Minimum GitLab Self-Managed | Tested diff versions, discussions, inline positions and merge on selected version |
| DEC-022 | GitHub PAT permissions | Least-privilege endpoint-by-endpoint permission matrix |
| DEC-023 | Cross-provider release gate | Independent P0 acceptance on GitHub.com and GitLab.com |
| DEC-024 | Traceability enforcement | CI validation of every SRS ID against traceability matrix |
