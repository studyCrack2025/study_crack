// js/black_consult.js

const API_URL = CONFIG.api.base;
const userId = localStorage.getItem('userId');
const chatList = document.getElementById('chatList');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

let currentFile = null;
let lastChatData = [];
let pollingInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }
    
    loadUserData(); // 사이드바 정보 로드
    loadChat();     // 채팅 로드
    pollingInterval = setInterval(loadChat, 3000); // 3초 폴링

    // 이벤트 리스너
    document.addEventListener('paste', handlePaste);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

// 1. 유저 정보 로드 (사이드바용)
async function loadUserData() {
    const token = localStorage.getItem('accessToken');
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        if(res.ok) {
            const data = await res.json();
            document.getElementById('userName').innerText = data.name || 'User';
            if (data.qualitative) {
                document.getElementById('userStatus').innerText = data.qualitative.status || '-';
                document.getElementById('userStream').innerText = data.qualitative.stream || '-';
            }
            const targetList = document.getElementById('userTargets');
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
    } catch(e) { console.error("UserInfo Error:", e); }
}

// 2. 채팅 데이터 로드
async function loadChat() {
    try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
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
    chatList.innerHTML = '';
    
    chats.forEach(msg => {
        const isMe = msg.sender === 'user';
        const typeClass = isMe ? 'user' : 'admin';
        const timeStr = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let contentHtml = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        // 파일 처리
        if (msg.file) {
            const isImg = msg.file.match(/\.(jpg|jpeg|png|gif)$/i);
            if (isImg) {
                contentHtml += `<br><img src="${msg.file}" class="chat-image" onclick="window.open('${msg.file}')">`;
            } else {
                contentHtml += `<br><a href="${msg.file}" target="_blank" class="file-attachment">
                    <i class="fas fa-file-download file-icon"></i> <span class="file-name">첨부파일</span>
                </a>`;
            }
        }

        const bubble = document.createElement('div');
        bubble.className = `message ${typeClass}`;
        
        if (isMe) {
            bubble.innerHTML = `<span class="msg-time">${timeStr}</span><div class="msg-bubble">${contentHtml}</div>`;
        } else {
            bubble.innerHTML = `<div class="msg-bubble">${contentHtml}</div><span class="msg-time">${timeStr}</span>`;
        }
        
        chatList.appendChild(bubble);
    });

    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chatContainer'); // ID 수정
    if(container) container.scrollTop = container.scrollHeight;
}

// 3. 메시지 전송 (400 에러 수정 포함)
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentFile) return;

    sendBtn.disabled = true;
    const token = localStorage.getItem('accessToken');
    let fileUrl = null;

    try {
        // 파일 업로드 로직
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
            const { uploadUrl, fileUrl: s3Url } = await presignRes.json();
            
            await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': currentFile.type }, body: currentFile });
            fileUrl = s3Url;
        }

        const msgData = {
            id: Date.now().toString(),
            sender: 'user',
            text: text,
            file: fileUrl,
            date: new Date().toISOString(),
            isRead: false
        };

        // ★ [수정] userId를 targetUserId로도 명시적으로 전송하여 백엔드 혼동 방지
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'save_chat_message', 
                userId: userId, 
                data: { 
                    targetUserId: userId, // 본인에게 쓰기 (Admin이 볼 때는 이 ID로 조회)
                    message: msgData 
                } 
            })
        });

        messageInput.value = '';
        messageInput.style.height = 'auto';
        clearFile();
        loadChat(); // 즉시 갱신

    } catch(e) {
        alert("전송 실패: " + e.message);
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// 파일 선택 핸들러
function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        if (file.size > 10 * 1024 * 1024) return alert("10MB 이하 파일만 가능합니다.");
        
        currentFile = file;
        document.getElementById('filePreview').style.display = 'inline-block';
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