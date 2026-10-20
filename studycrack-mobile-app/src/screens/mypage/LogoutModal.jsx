import { Modal } from '../../components/Modal.jsx';

export function LogoutModal({ open = false }) {
  return <Modal open={open} dismissAction="closeLogoutModal" ariaLabel="로그아웃 확인">
    <p className="sc-modal-padded-title">로그아웃하시겠어요?</p>
    <div className="support-btns">
      <button type="button" className="btn btn-secondary" data-action="closeLogoutModal">취소</button>
      <button type="button" className="btn btn-primary" data-action="confirmLogout">로그아웃</button>
    </div>
  </Modal>;
}
