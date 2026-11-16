# ReviewDock — Product & Software Specification

> **Tài liệu:** Product Requirements & Software Requirements Specification (PRD/SRS)  
> **Sản phẩm:** ReviewDock  
> **Repository:** minh-lb/vscode-reviewdock  
> **Phiên bản tài liệu:** 0.1.0  
> **Trạng thái:** Draft — chờ xác nhận yêu cầu  
> **Ngày cập nhật:** 2026-11-16

## 1. Tổng quan

### 1.1. Mô tả sản phẩm

ReviewDock là extension cho Visual Studio Code, giúp developer quản lý GitLab Merge Request (MR) và thực hiện code review ngay trong IDE.

Sản phẩm đưa các hoạt động thường xuyên trong quy trình review — tìm MR, xem metadata, đọc diff, thảo luận, theo dõi pipeline/approval và merge — vào một workflow thống nhất trong VS Code.

ReviewDock là client cho GitLab. Các quy tắc phân quyền, branch protection, approval rules, merge checks và chính sách của project vẫn do GitLab server thực thi.

### 1.2. Vấn đề cần giải quyết

Developer thường phải chuyển qua lại giữa VS Code và GitLab Web để:
- Tìm MR được assign hoặc yêu cầu review.
- Đọc thay đổi theo từng file.
- Viết comment chung hoặc comment gắn với dòng code.
- Theo dõi discussion, pipeline và approval.
- Thực hiện merge khi MR đủ điều kiện.

Việc chuyển ngữ cảnh làm gián đoạn công việc và khiến thông tin review bị phân tán.

### 1.3. Tầm nhìn

Biến VS Code thành một không gian làm việc thuận tiện cho GitLab code review, nhưng vẫn tôn trọng GitLab là nguồn dữ liệu và nơi thực thi quyền hạn cuối cùng.

### 1.4. Nguyên tắc sản phẩm

1. **GitLab is the source of truth:** không tự suy diễn trạng thái merge, approval hoặc pipeline.
2. **Review-first:** trải nghiệm diff và discussion là chức năng cốt lõi, không chỉ là danh sách MR.
3. **Safe by default:** thao tác ghi phải có phản hồi rõ ràng; merge phải có xác nhận và kiểm tra trạng thái mới nhất.
4. **Least privilege:** chỉ yêu cầu quyền truy cập cần thiết cho các tính năng đã bật.
5. **Native where practical:** ưu tiên trải nghiệm VS Code quen thuộc; chỉ dùng Webview khi native API không đáp ứng được UX.
6. **No silent mutation:** không tự gửi comment, approve, resolve discussion hoặc merge khi chưa có hành động rõ ràng của người dùng.

## 2. Mục tiêu và ngoài phạm vi

### 2.1. Mục tiêu

- Kết nối GitLab.com và GitLab Self-Managed.
- Phát hiện hoặc cấu hình GitLab project tương ứng với workspace.
- Hiển thị danh sách MR theo các bộ lọc hữu ích.
- Xem metadata, diff và discussion của MR.
- Tạo comment chung, inline comment và reply.
- Theo dõi pipeline và approval.
- Thực hiện merge khi người dùng có quyền và GitLab xác nhận MR đủ điều kiện.
- Bảo vệ token và tránh thao tác trên dữ liệu lỗi thời.

### 2.2. Không thuộc phạm vi phiên bản đầu

- Tạo/sửa GitLab repository và quản trị project.
- Quản lý GitLab Issues, Epics, Milestones.
- Thay thế Git client: commit, push, rebase, cherry-pick.
- Cấu hình hoặc chạy GitLab CI/CD pipeline.
- Bỏ qua protected branch, approval rules hoặc merge checks.
- Đồng bộ hai chiều với GitHub, Bitbucket hay nền tảng khác.
- AI review hoặc tự động sửa code (có thể xem xét ở phiên bản sau).

## 3. Người dùng và quyền hạn

### 3.1. Developer / Author

- Xem MR do mình tạo.
- Theo dõi review, discussion và pipeline.
- Trả lời comment.
- Cập nhật nội dung thảo luận nếu GitLab cho phép.
- Merge MR nếu có quyền và đủ điều kiện.

### 3.2. Reviewer

- Xem MR được yêu cầu review hoặc được assign.
- Đọc diff và discussion.
- Tạo comment chung hoặc inline comment.
- Reply và resolve discussion khi được phép.
- Approve hoặc request changes nếu tính năng và quyền GitLab hỗ trợ.

### 3.3. Maintainer

- Thực hiện các thao tác reviewer có thể làm.
- Theo dõi trạng thái merge.
- Merge MR theo project policy.
- Không thể dùng ReviewDock để vượt qua quyền hạn hoặc quy tắc của GitLab.

## 4. Phạm vi chức năng và yêu cầu

Mức ưu tiên:
- **P0 — MVP:** bắt buộc để phát hành phiên bản đầu.
- **P1 — Next:** quan trọng, có thể phát hành sau MVP.
- **P2 — Later:** mở rộng.

### 4.1. Authentication và GitLab connection

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| AUTH-001 | Kết nối GitLab.com. | P0 |
| AUTH-002 | Cho phép cấu hình GitLab Self-Managed base URL. | P0 |
| AUTH-003 | Xác thực an toàn; phương thức PAT/OAuth cần được chốt trước implementation. | P0 |
| AUTH-004 | Lưu secret bằng VS Code SecretStorage, không lưu token trong settings hoặc file workspace. | P0 |
| AUTH-005 | Cho phép kiểm tra kết nối và hiển thị user hiện tại. | P0 |
| AUTH-006 | Cho phép đổi token, disconnect và xử lý token hết hạn/bị thu hồi. | P0 |
| AUTH-007 | Không ghi token, authorization header hoặc dữ liệu nhạy cảm vào log. | P0 |

### 4.2. Project và workspace

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| PROJ-001 | Cho phép chọn GitLab project. | P0 |
| PROJ-002 | Đọc Git remote của workspace để đề xuất project tương ứng. | P0 |
| PROJ-003 | Cho phép cấu hình project thủ công khi không nhận diện được remote. | P0 |
| PROJ-004 | Hiển thị project đang active và GitLab instance tương ứng. | P0 |
| PROJ-005 | Hỗ trợ nhiều project/remote; cách tổ chức danh sách sẽ được chốt trong UX design. | P1 |
| PROJ-006 | Không gửi repository URL hoặc workspace metadata đến dịch vụ bên thứ ba. | P0 |

### 4.3. Merge Request list và discovery

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| MR-001 | Hiển thị MR của project đang chọn trong VS Code. | P0 |
| MR-002 | Hỗ trợ filter theo trạng thái Open, Closed, Merged. | P0 |
| MR-003 | Có nhóm Created by me, Assigned to me và Review requested from me khi API và quyền truy cập hỗ trợ. | P0 |
| MR-004 | Tìm kiếm MR theo IID và title. | P0 |
| MR-005 | Hỗ trợ pagination hoặc tải thêm, không tải toàn bộ MR một lần. | P0 |
| MR-006 | Hiển thị title, IID, author, source/target branch, assignees, reviewers, labels và thời điểm cập nhật. | P0 |
| MR-007 | Hiển thị draft state, conflict/mergeability và trạng thái pipeline/approval nếu có dữ liệu. | P0 |
| MR-008 | Refresh thủ công và cập nhật trạng thái sau mutation. | P0 |
| MR-009 | Mở MR trên GitLab Web bằng external link. | P1 |

### 4.4. Merge Request detail

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| DETAIL-001 | Hiển thị description, author, IID, trạng thái và thời gian. | P0 |
| DETAIL-002 | Hiển thị source branch và target branch. | P0 |
| DETAIL-003 | Hiển thị assignees, reviewers, labels và milestone nếu có. | P0 |
| DETAIL-004 | Hiển thị số commit, file thay đổi, additions và deletions khi API cung cấp. | P0 |
| DETAIL-005 | Điều hướng giữa Overview, Changes, Discussions, Pipeline và Approvals. | P0/P1 |

### 4.5. Diff và code review

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| DIFF-001 | Liệt kê các file thay đổi trong MR. | P0 |
| DIFF-002 | Hiển thị unified diff và/hoặc side-by-side diff. | P0 |
| DIFF-003 | Hiển thị trạng thái added, modified, deleted, renamed. | P0 |
| DIFF-004 | Điều hướng từ danh sách file tới diff tương ứng. | P0 |
| DIFF-005 | Hiển thị additions/deletions và line number hai phía khi có. | P0 |
| DIFF-006 | Hỗ trợ comment gắn với một dòng hoặc một đoạn dòng trong diff. | P0 |
| DIFF-007 | Hiển thị discussion hiện có tại vị trí code liên quan. | P0 |
| DIFF-008 | Xử lý diff quá lớn, file binary, file không có patch hoặc diff version đã thay đổi. | P0 |
| DIFF-009 | Có thể mở file ở working tree hoặc mở diff tương ứng bằng VS Code editor khi mapping hợp lệ. | P1 |

**Quy tắc inline comment:** comment phải được gắn với diff version và vị trí dòng hợp lệ theo GitLab API. Nếu diff đã thay đổi hoặc GitLab không còn chấp nhận vị trí đó, extension phải báo lỗi và yêu cầu tải lại diff; không được âm thầm chuyển comment thành comment chung.

### 4.6. Comments và discussions

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| DISC-001 | Hiển thị discussion và note của MR. | P0 |
| DISC-002 | Tạo comment chung cho MR. | P0 |
| DISC-003 | Tạo inline comment trên diff. | P0 |
| DISC-004 | Reply vào discussion hiện có. | P0 |
| DISC-005 | Hiển thị author, timestamp và trạng thái resolved/unresolved. | P0 |
| DISC-006 | Resolve/reopen discussion khi API và quyền cho phép. | P1 |
| DISC-007 | Edit/delete comment của chính người dùng khi GitLab cho phép. | P1 |
| DISC-008 | Chống gửi trùng khi request timeout hoặc người dùng bấm submit nhiều lần. | P0 |
| DISC-009 | Hiển thị lỗi rõ ràng nếu comment bị từ chối do quyền, vị trí diff hoặc trạng thái MR. | P0 |

### 4.7. Approval và review decision

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| APR-001 | Hiển thị approval rules và số approval hiện tại/yêu cầu nếu GitLab cung cấp. | P1 |
| APR-002 | Hiển thị người đã approve và trạng thái approval. | P1 |
| APR-003 | Cho phép approve/unapprove khi được hỗ trợ và có quyền. | P1 |
| APR-004 | Không coi việc tạo comment là một approval. | P0 |
| APR-005 | Không tự đánh dấu MR đã đủ approval nếu API không xác nhận. | P0 |

### 4.8. Pipeline

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| PIPE-001 | Hiển thị pipeline gần nhất liên quan tới MR/head commit. | P1 |
| PIPE-002 | Hiển thị trạng thái pending, running, success, failed, canceled hoặc skipped khi có. | P1 |
| PIPE-003 | Hiển thị job và lỗi cơ bản của job thất bại khi API cho phép. | P1 |
| PIPE-004 | Cho phép mở pipeline/job trên GitLab Web. | P1 |
| PIPE-005 | Không suy ra pipeline pass từ dữ liệu cache hoặc dữ liệu đã lỗi thời. | P0 |

### 4.9. Merge

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| MERGE-001 | Hiển thị merge eligibility/status do GitLab trả về. | P0 |
| MERGE-002 | Chỉ hiển thị hoặc kích hoạt Merge action khi phù hợp với quyền và trạng thái MR. | P0 |
| MERGE-003 | Yêu cầu người dùng xác nhận trước khi merge. | P0 |
| MERGE-004 | Trước khi gửi merge request, refresh metadata cần thiết và gửi expected source SHA/head SHA nếu API hỗ trợ. | P0 |
| MERGE-005 | Hỗ trợ squash hoặc các merge options theo cấu hình project/API. | P1 |
| MERGE-006 | Hiển thị kết quả thành công hoặc lỗi từ GitLab. | P0 |
| MERGE-007 | Xử lý conflict, pipeline chưa đạt, approval thiếu, SHA mismatch và permission denied. | P0 |
| MERGE-008 | Không bypass protected branch, approval rules hoặc merge checks. | P0 |
| MERGE-009 | Không tự động bật merge-when-pipeline-succeeds nếu người dùng chưa chọn rõ ràng. | P0 |

## 5. User workflows

### 5.1. Kết nối GitLab lần đầu

1. Người dùng mở ReviewDock.
2. Chọn Add GitLab Instance.
3. Nhập GitLab URL nếu dùng Self-Managed; GitLab.com dùng URL mặc định.
4. Hoàn thành phương thức xác thực đã được chọn trong thiết kế.
5. ReviewDock kiểm tra token và hiển thị tài khoản hiện tại.
6. Token được lưu trong SecretStorage.
7. Người dùng chọn project hoặc để extension đề xuất project từ Git remote.

**Kết quả mong đợi:** kết nối được xác nhận; token không xuất hiện trong log hoặc settings.

### 5.2. Review một Merge Request

1. Người dùng mở một nhóm MR (ví dụ Review requested).
2. Chọn MR.
3. ReviewDock tải metadata và danh sách file thay đổi.
4. Người dùng mở file và đọc diff.
5. Người dùng xem discussion hiện có.
6. Người dùng tạo comment chung hoặc inline comment.
7. ReviewDock gửi request, hiển thị kết quả và refresh discussion.

### 5.3. Merge một Merge Request

1. Người dùng mở MR.
2. ReviewDock refresh trạng thái MR, approval và pipeline liên quan.
3. ReviewDock hiển thị điều kiện còn thiếu hoặc trạng thái mergeability.
4. Người dùng chọn Merge.
5. ReviewDock hiển thị hộp thoại xác nhận, target branch và merge options.
6. ReviewDock gửi merge request với SHA hiện tại khi endpoint hỗ trợ.
7. GitLab quyết định kết quả cuối cùng.
8. ReviewDock hiển thị kết quả và cập nhật MR.

## 6. UI/UX specification

### 6.1. Entry point

- Có Activity Bar container tên ReviewDock.
- Sidebar dùng Tree View hoặc view tương đương để hiển thị project và nhóm MR.
- Có command để refresh, chọn project, cấu hình instance và mở MR.

### 6.2. Cấu trúc điều hướng dự kiến

- ReviewDock
  - GitLab Instances / Projects
  - Review requested
  - Assigned to me
  - Created by me
  - Open
  - Closed / Merged

Các nhóm có thể được điều chỉnh theo project đang active và bộ lọc người dùng.

### 6.3. MR detail

Các khu vực nội dung dự kiến:
- Overview
- Changes
- Discussions
- Approvals
- Pipeline

### 6.4. UX states bắt buộc

Mỗi view có trạng thái:
- Loading
- Loaded / Empty
- Error
- Authentication required
- Permission denied
- Stale data / Refresh required

Các thao tác ghi phải có progress indicator, disable submit trong lúc request đang chạy và thông báo kết quả rõ ràng.

### 6.5. Accessibility

- Hỗ trợ keyboard navigation.
- Dùng VS Code theme colors và accessibility conventions.
- Không chỉ dùng màu sắc để thể hiện trạng thái.
- Có label/tooltip dễ hiểu cho icon và action.

## 7. Kiến trúc kỹ thuật dự kiến

### 7.1. Technology baseline

- TypeScript.
- VS Code Extension API.
- GitLab REST API v4.
- VS Code SecretStorage.
- VS Code TreeView, commands, diff/editor APIs.
- Webview chỉ sử dụng khi cần giao diện mà native API không đáp ứng.

### 7.2. Module boundaries

**Extension Host / Activation**
- Đăng ký commands, views, providers.
- Quản lý lifecycle và workspace events.

**Domain**
- Models: GitLabInstance, Project, MergeRequest, DiffFile, Discussion, Note, Pipeline, Approval.
- Use cases: list MRs, get MR detail, load diff, create note, reply discussion, merge MR.

**GitLab API Client**
- Base URL và versioned endpoint handling.
- Authentication header.
- Pagination.
- Timeout, cancellation và retry có kiểm soát.
- Chuẩn hóa lỗi API.

**Application Services**
- AuthenticationService.
- ProjectService.
- MergeRequestService.
- DiffService.
- DiscussionService.
- ApprovalService.
- PipelineService.

**Presentation**
- Activity Bar / Tree Views.
- MR detail view.
- Diff integration.
- Discussion UI.
- Notifications và confirmation dialogs.

**Storage**
- SecretStorage cho token.
- Workspace/global state chỉ lưu cấu hình không nhạy cảm.

### 7.3. Kiến trúc nguyên tắc

- UI không gọi HTTP trực tiếp.
- Không để GitLab response shape rò rỉ vào mọi lớp; dùng domain models/DTO mapping.
- Có dependency boundary giữa VS Code API và domain logic để unit test.
- Dùng cancellation token khi người dùng đổi MR hoặc đóng view.
- Không cache dữ liệu nhạy cảm ngoài nhu cầu cần thiết.
- Không dùng background polling dày; refresh theo thao tác người dùng và cơ chế cập nhật được thiết kế sau.

## 8. GitLab API integration

### 8.1. API scope

Tích hợp dự kiến với các nhóm endpoint GitLab REST API v4:
- Projects: tìm và lấy thông tin project.
- Merge Requests: list, detail, changes/diffs, merge.
- Notes: comment chung và reply phù hợp với API.
- Discussions: inline discussion, reply và resolve.
- Approvals: trạng thái và thao tác approval nếu được hỗ trợ.
- Pipelines / Jobs: trạng thái pipeline liên quan MR.

### 8.2. API behavior

- Tôn trọng pagination và rate limit.
- Đọc pagination headers hoặc cơ chế pagination tương ứng.
- Phân biệt lỗi authentication (401), permission (403), not found (404), validation (400/422), rate limit (429) và server/network errors.
- Không hardcode giả định mọi GitLab Self-Managed instance chạy cùng phiên bản.
- Xác minh endpoint và field support với phiên bản GitLab tối thiểu sẽ được chốt.
- Với diff discussions, lưu và gửi đủ position metadata mà GitLab yêu cầu (base/start/head SHA, old/new path, old/new line) theo loại diff.
- Với merge, coi response từ GitLab là kết quả có thẩm quyền; client-side pre-check chỉ nhằm cải thiện UX.

### 8.3. Version compatibility

Phiên bản GitLab tối thiểu chưa được quyết định. Trước implementation cần:
1. Chọn phiên bản GitLab tối thiểu.
2. Kiểm tra các endpoint diff/discussion/approval trên phiên bản đó.
3. Xác định fallback cho endpoint hoặc field không có.
4. Ghi rõ capability khác nhau giữa GitLab.com và Self-Managed.

## 9. Security & privacy

| ID | Yêu cầu |
|---|---|
| SEC-001 | Token chỉ lưu trong VS Code SecretStorage. |
| SEC-002 | Không lưu token trong settings.json, source code, log hoặc workspace files. |
| SEC-003 | Chỉ gửi token tới host GitLab do người dùng cấu hình/xác nhận. |
| SEC-004 | Bắt buộc HTTPS mặc định; ngoại lệ HTTP cho Self-Managed nếu có sẽ cần quyết định bảo mật rõ ràng. |
| SEC-005 | Không gửi code, diff, comment hoặc token tới dịch vụ bên thứ ba. |
| SEC-006 | Không log Authorization header hoặc secret. |
| SEC-007 | Xác nhận rõ trước các thao tác ghi quan trọng, đặc biệt là merge. |
| SEC-008 | Tôn trọng quyền API của user; không tìm cách vượt qua quyền GitLab. |
| SEC-009 | Có lệnh disconnect để xóa credential đã lưu. |
| SEC-010 | Không bật telemetry mặc định trong MVP; nếu bổ sung sau này phải có thiết kế consent và privacy riêng. |

## 10. Non-functional requirements

### 10.1. Performance

- Không block extension activation bằng request mạng.
- Dùng pagination cho danh sách MR.
- Không tải tất cả diff/discussion khi chưa cần.
- Có timeout và cancellation cho request.
- UI phải phản hồi được trong lúc network request chạy.

**Mục tiêu đo lường ban đầu (cần benchmark):**
- Activation không chờ GitLab network.
- Với response API bình thường, view hiển thị loading state ngay và cập nhật khi dữ liệu về.
- Cache chỉ được dùng để tăng tốc hiển thị; dữ liệu cache phải được nhận diện là có thể cũ.

### 10.2. Reliability

- Không crash extension khi API lỗi hoặc response thiếu field.
- Mutation không được tự retry mù quáng nếu có nguy cơ tạo comment/merge trùng.
- Có request correlation/log context nhưng không chứa secret.
- Xử lý cancellation khi view hoặc workspace thay đổi.

### 10.3. Compatibility

- Windows, macOS và Linux.
- GitLab.com.
- GitLab Self-Managed trong phạm vi phiên bản đã công bố.
- VS Code stable; minimum VS Code engine version sẽ được chốt trước release.

### 10.4. Maintainability

- TypeScript strict mode.
- Lint, format và test tự động.
- Module có trách nhiệm rõ ràng.
- API contract và behavior quan trọng có unit/integration tests.

## 11. Error handling

| Tình huống | Hành vi mong đợi |
|---|---|
| Token không hợp lệ/hết hạn | Yêu cầu kết nối lại; không lặp request vô hạn. |
| Không có quyền project/MR | Hiển thị permission error và giữ nguyên dữ liệu không thể cập nhật. |
| MR không tồn tại hoặc đã bị xóa | Thông báo và cho phép quay lại danh sách. |
| Diff đã thay đổi | Yêu cầu refresh diff trước khi gửi inline comment. |
| Discussion đã resolve hoặc không thể reply | Hiển thị lỗi từ GitLab; không chuyển thành comment khác. |
| Merge conflict / approval thiếu / pipeline fail | Hiển thị trạng thái GitLab và không giả định merge thành công. |
| SHA mismatch | Refresh MR và yêu cầu người dùng xác nhận lại. |
| Rate limit / network timeout | Hiển thị lỗi có thể retry; mutation phải tránh gửi trùng. |
| GitLab Self-Managed không tương thích | Hiển thị endpoint/capability không được hỗ trợ và phiên bản cần thiết nếu xác định được. |

## 12. Testing strategy

### 12.1. Unit tests

- GitLab URL parsing và project identification.
- API client: auth header, pagination, timeout, error mapping.
- Mapping GitLab DTO sang domain models.
- Diff position calculation/mapping.
- Merge eligibility presentation logic.
- Secret/config handling abstractions.

### 12.2. Integration tests

- GitLab API client với mock server.
- Authentication success/failure.
- List/detail MR.
- Load diff.
- Create general note.
- Create/reply inline discussion.
- Approval/pipeline retrieval.
- Merge success và các trường hợp bị từ chối.

### 12.3. Manual acceptance tests

- GitLab.com.
- Ít nhất một GitLab Self-Managed instance trong phạm vi version support.
- User chỉ có quyền read.
- User có quyền comment/review.
- User có quyền merge.
- MR có conflict, pipeline fail, approval thiếu và diff thay đổi.

Không dùng project production để chạy test mutation nếu chưa có dữ liệu/test project được cho phép.

## 13. MVP acceptance criteria

MVP được xem là đạt khi:

1. Người dùng kết nối được GitLab instance.
2. Token được lưu bằng SecretStorage và không xuất hiện trong settings/log.
3. Người dùng chọn hoặc nhận diện được GitLab project.
4. MR list có filter và pagination.
5. Người dùng xem được MR detail.
6. Người dùng xem được file changes và diff.
7. Người dùng tạo được general comment.
8. Người dùng tạo được inline comment trên diff hợp lệ.
9. Người dùng reply được discussion.
10. Người dùng refresh được dữ liệu và nhận biết trạng thái stale.
11. Người dùng merge được MR khi GitLab cho phép, sau bước xác nhận.
12. Các lỗi auth, permission, network, stale diff, SHA mismatch và merge rejection được xử lý rõ ràng.
13. Không có thao tác nào bypass GitLab permission hoặc project policy.

Approval và pipeline UI có thể được phát hành ở P1 nếu cần giảm phạm vi MVP; tuy nhiên merge vẫn phải dựa trên quyết định cuối cùng của GitLab server.

## 14. Roadmap đề xuất

### Phase 0 — Product & technical decisions
- Chốt authentication.
- Chốt UX architecture.
- Chốt GitLab minimum version.
- Chốt MVP scope và acceptance criteria.

### Phase 1 — Foundation
- Extension skeleton.
- Configuration và SecretStorage.
- GitLab API client.
- Instance/project selection.
- Error handling và tests nền tảng.

### Phase 2 — MR management
- Activity Bar / Tree Views.
- MR list, filter, search, pagination.
- MR detail và refresh.

### Phase 3 — Review workflow
- Diff viewer.
- General comments.
- Inline comments.
- Discussion list và reply.

### Phase 4 — Merge readiness
- Approval information.
- Pipeline status.
- Merge validation, confirmation và merge action.

### Phase 5 — Hardening & release
- Compatibility tests.
- Accessibility và performance.
- Documentation.
- Packaging, Marketplace metadata và release checklist.

## 15. Open questions — cần xác nhận trước implementation

| ID | Quyết định cần chốt | Các lựa chọn / đề xuất |
|---|---|---|
| DEC-001 | Authentication | PAT cho MVP; OAuth 2.0; hoặc hỗ trợ cả hai. |
| DEC-002 | UI architecture | Native VS Code UI; Webview; hoặc hybrid. Đề xuất hybrid, ưu tiên native. |
| DEC-003 | Inline comment | Bắt buộc trong MVP hay chuyển sang phase sau. Đề xuất bắt buộc vì đây là giá trị cốt lõi. |
| DEC-004 | Project discovery | Auto-detect Git remote và cho phép chọn thủ công. |
| DEC-005 | GitLab compatibility | Chốt minimum GitLab version cho Self-Managed. |
| DEC-006 | Multi-project | Một project active theo workspace hay quản lý nhiều project/instance đồng thời. |
| DEC-007 | Review decision | MVP có cần Approve/Request changes hay chỉ comment và discussion. |
| DEC-008 | Pipeline & approval | Đưa vào MVP hay P1. |
| DEC-009 | Merge options | Có hỗ trợ squash và merge when pipeline succeeds trong MVP không. |
| DEC-010 | Localization | English-only ban đầu hay hỗ trợ English và Vietnamese. |

## 16. Definition of Done cho từng feature

Một feature chỉ được coi là hoàn thành khi:
- Requirements và edge cases đã được xác định.
- Có implementation tách biệt UI và domain/API logic.
- Có unit tests cho logic quan trọng.
- Có integration tests cho API mutation hoặc retrieval quan trọng.
- Có loading, empty, error và permission states.
- Không để lộ token hoặc dữ liệu nhạy cảm.
- Có hướng dẫn sử dụng/cấu hình nếu feature cần thiết lập.
- Acceptance criteria tương ứng được kiểm tra.

---

**Tài liệu này mô tả yêu cầu sản phẩm, không phải xác nhận rằng implementation đã bắt đầu. Mọi quyết định trong mục 15 vẫn đang mở cho đến khi được chủ sản phẩm xác nhận.**
