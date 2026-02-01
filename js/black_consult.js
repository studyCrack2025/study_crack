// js/black_consult.js

const API_URL = CONFIG.api.base;
const userId = localStorage.getItem('userId');
const chatList = document.getElementById('chatList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentFile = null;
let lastChatData = [];
let pollingInterval = null;

// [추가] 인증 에러 처리 함수 (무한 루프 방지)
function handleAuthError() {
    console.warn("인증 실패: 세션 만료 또는 토큰 없음");
    if (pollingInterval) clearInterval(pollingInterval); // ★ 중요: 반복 요청 중단
    alert("세션이 만료되었습니다. 다시 로그인해주세요.");
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. 초기 진입 시 토큰 체크
    const token = localStorage.getItem('accessToken');
    if (!userId || !token) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }
    
    // 2. 데이터 로드 시작
    loadUserData(); 
    loadChat();      
    
    // 3. 폴링 시작 (3초마다 채팅 갱신)
    pollingInterval = setInterval(loadChat, 3000); 

    // 이벤트 리스너들
    document.addEventListener('paste', handlePaste);
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

// 1. 유저 정보 로드
async function loadUserData() {
    const token = localStorage.getItem('accessToken');
    if (!token) return handleAuthError();

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (res.status === 401) return handleAuthError(); // ★ 401 체크

        if(res.ok) {
            const data = await res.json();
            
            // 사이드바 정보 업데이트
            const nameEl = document.getElementById('userName');
            if(nameEl) nameEl.innerText = data.name || 'User';

            if (data.qualitative) {
                const statusEl = document.getElementById('userStatus');
                const streamEl = document.getElementById('userStream');
                if(statusEl) statusEl.innerText = data.qualitative.status || '-';
                if(streamEl) streamEl.innerText = data.qualitative.stream || '-';
            }
            
            // 목표 대학
            const targetList = document.getElementById('userTargets');
            if (targetList) {
                targetList.innerHTML = '';
                if (data.targetUnivs && data.targetUnivs.length > 0) {
                    data.targetUnivs.forEach((u, i) => {
                        if (u && u.univ && i < 2) {
                            const li = document.createElement('li');
                            li.innerText = `${u.univ} ${u.major || ''}`;
                            targetList.appendChild(li);
                        }
                    });
                } else {
                    targetList.innerHTML = '<li>설정된 목표 없음</li>';
                }
            }

            // 멘토 이름 업데이트
            const mentorNameEl = document.getElementById('mentorNameDisplay');
            if (mentorNameEl) {
                mentorNameEl.innerText = data.tutorName || "배정 중인 컨설턴트";
            }
        }
    } catch(e) { console.error("UserInfo Error:", e); }
}

// 2. 채팅 로드 (반복 호출됨)
async function loadChat() {
    const token = localStorage.getItem('accessToken');
    if (!token) return; // 토큰 없으면 조용히 종료 (또는 에러 처리)

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (res.status === 401) return handleAuthError(); // ★ 401 체크 -> 루프 중단

        if(res.ok) {
            const data = await res.json();
            const chats = data.consultChat || [];
            
            // 변경사항 있을 때만 렌더링
            if (JSON.stringify(chats) !== JSON.stringify(lastChatData)) {
                lastChatData = chats;
                renderChat(chats);
            }
        }
    } catch(e) { console.error("Chat Load Error:", e); }
}

function renderChat(chats) {
    if(!chatList) return;
    chatList.innerHTML = '';
    
    chats.forEach(msg => {
        const isMe = msg.sender === 'user'; 
        const typeClass = isMe ? 'user' : 'admin';
        
        const timeStr = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let contentHtml = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        if (msg.file) {
            const isImg = msg.file.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            if (isImg) {
                contentHtml += `<br><img src="${msg.file}" class="chat-image" onclick="window.open('${msg.file}')">`;
            } else {
                const fileName = decodeURIComponent(msg.file.split('/').pop().split('_').slice(1).join('_'));
                contentHtml += `<br><a href="${msg.file}" target="_blank" class="file-attachment">
                    <i class="fas fa-file-alt"></i> <span class="file-name">${fileName || '첨부파일'}</span>
                </a>`;
            }
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${typeClass}`;
        
        if (isMe) {
            msgDiv.innerHTML = `<span class="msg-time">${timeStr}</span><div class="msg-bubble">${contentHtml}</div>`;
        } else {
            msgDiv.innerHTML = `<div class="msg-bubble">${contentHtml}</div><span class="msg-time">${timeStr}</span>`;
        }
        
        chatList.appendChild(msgDiv);
    });

    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chatContainer');
    if(container) container.scrollTop = container.scrollHeight;
}

// 3. 메시지 전송
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentFile) return;

    sendBtn.disabled = true;
    const token = localStorage.getItem('accessToken');
    if (!token) return handleAuthError();

    let fileUrl = null;

    try {
        // 1. 파일 업로드
        if (currentFile) {
            const presignRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'get_presigned_url', 
                    userId: userId, 
                    data: { fileName: currentFile.name, fileType: currentFile.type, folder: 'chat' } 
                })
            });
            
            if (presignRes.status === 401) return handleAuthError();
            if (!presignRes.ok) throw new Error("Upload URL Error");
            
            const { uploadUrl, fileUrl: s3Url } = await presignRes.json();
            await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': currentFile.type }, body: currentFile });
            fileUrl = s3Url;
        }

        // 2. 메시지 저장
        const msgData = {
            id: Date.now().toString(),
            sender: 'user', 
            text: text,
            file: fileUrl,
            date: new Date().toISOString(),
            isRead: false
        };

        const saveRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'save_chat_message', 
                userId: userId, 
                data: { targetUserId: userId, message: msgData } 
            })
        });

        if (saveRes.status === 401) return handleAuthError();

        // 성공 시 초기화
        messageInput.value = '';
        messageInput.style.height = 'auto';
        clearFile();
        loadChat(); 

    } catch(e) {
        alert("전송 실패: " + e.message);
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 10 * 1024 * 1024) return alert("10MB 이하 파일만 가능합니다.");
        
        currentFile = file;
        document.getElementById('filePreview').style.display = 'inline-flex';
        document.getElementById('previewName').innerText = file.name;
    }
}

function handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            handleFileSelect({ files: [file] });
        }
    }
}

function clearFile() {
    currentFile = null;
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('fileInput').value = '';
}

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function escapeHtml(text) {
    if (!text) return '';
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}