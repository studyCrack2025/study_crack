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
    
    loadUserData(); 
    loadChat();      
    pollingInterval = setInterval(loadChat, 3000); 

    // 붙여넣기 (이미지)
    document.addEventListener('paste', handlePaste);
    
    // 엔터키 전송 (한글 중복 방지)
    messageInput.addEventListener('keydown', (e) => {
        // 한글 조합 중이면 함수 종료 (전송 안 함)
        if (e.isComposing) return;

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 줄바꿈 방지
            sendMessage();
        }
    });
});

// 1. 사이드바 유저 정보 로드
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

// 2. 채팅 로드
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
            
            // 변경사항 있을 때만 렌더링 (깜빡임 방지)
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
        // sender가 'user'면 isMe = true (오른쪽 배치)
        const isMe = msg.sender === 'user'; 
        const typeClass = isMe ? 'user' : 'admin';
        
        const timeStr = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let contentHtml = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        // 파일 렌더링
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
        
        // CSS 클래스(user/admin)에 따라 align-self가 결정됨
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

    // 더블클릭 방지
    sendBtn.disabled = true;
    const token = localStorage.getItem('accessToken');
    let fileUrl = null;

    try {
        if (currentFile) {
            // S3 URL 발급
            const presignRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'get_presigned_url', 
                    userId: userId, 
                    data: { fileName: currentFile.name, fileType: currentFile.type, folder: 'chat' } 
                })
            });
            if(!presignRes.ok) throw new Error("Upload URL Error");
            const { uploadUrl, fileUrl: s3Url } = await presignRes.json();
            
            // S3 업로드
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

        // 메시지 저장 요청
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'save_chat_message', 
                userId: userId, 
                data: { targetUserId: userId, message: msgData } 
            })
        });

        // 초기화
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