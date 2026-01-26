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
    
    loadChat();     
    pollingInterval = setInterval(loadChat, 3000); 

    // 붙여넣기 (이미지)
    document.addEventListener('paste', handlePaste);
    
    // Enter키 전송 (Shift+Enter는 줄바꿈)
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 줄바꿈 방지
            sendMessage();
        }
    });
});

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
        // ★ 중요: 보낸 사람이 'user'면 오른쪽(User), 아니면 왼쪽(Admin)
        const isMe = msg.sender === 'user'; 
        const typeClass = isMe ? 'user' : 'admin';
        
        const timeStr = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let contentHtml = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        // 파일 렌더링
        if (msg.file) {
            const isImg = msg.file.match(/\.(jpg|jpeg|png|gif|webp)$/i);
            if (isImg) {
                // 이미지인 경우
                contentHtml += `<br><img src="${msg.file}" class="chat-image" onclick="window.open('${msg.file}')">`;
            } else {
                // 문서 파일인 경우 (PDF 등)
                const fileName = decodeURIComponent(msg.file.split('/').pop().split('_').slice(1).join('_')); // 타임스탬프 제거 시도
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

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentFile) return;

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
            sender: 'user', // ★ User가 보냄
            text: text,
            file: fileUrl,
            date: new Date().toISOString(),
            isRead: false
        };

        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'save_chat_message', 
                userId: userId, 
                data: { targetUserId: userId, message: msgData } 
            })
        });

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