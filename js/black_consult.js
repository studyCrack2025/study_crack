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
    
    // 초기 로드 및 폴링 시작
    loadChat();
    pollingInterval = setInterval(loadChat, 3000); // 3초마다 갱신

    // 붙여넣기 이벤트 (이미지)
    document.addEventListener('paste', handlePaste);
    
    // 엔터키 전송 (Shift+Enter는 줄바꿈)
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

// 채팅 데이터 로드
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
            
            // 데이터가 변경되었을 때만 렌더링 (깜빡임 방지)
            if (JSON.stringify(chats) !== JSON.stringify(lastChatData)) {
                lastChatData = chats;
                renderChat(chats);
                // 읽음 처리 요청 (User가 봤으니 Admin 메시지를 읽음 처리할 필요는 없지만, 로직상 넣어둠)
                // (실제로는 Admin이 볼 때 User 메시지를 읽음 처리함)
            }
        }
    } catch(e) { console.error("Chat Load Error:", e); }
}

function renderChat(chats) {
    chatList.innerHTML = '';
    
    // 날짜별 그룹화 로직 등은 생략하고 단순 나열 (필요시 추가 가능)
    chats.forEach(msg => {
        const isMe = msg.sender === 'user';
        const typeClass = isMe ? 'user' : 'admin';
        const timeStr = new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let contentHtml = escapeHtml(msg.text).replace(/\n/g, '<br>');
        
        // 파일이 있는 경우
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
        // 내 메시지: 시간 + 버블 / 상대 메시지: 버블 + 시간
        if (isMe) {
            bubble.innerHTML = `<span class="msg-time">${timeStr}</span><div class="msg-bubble">${contentHtml}</div>`;
        } else {
            bubble.innerHTML = `<div class="msg-bubble">${contentHtml}</div><span class="msg-time">${timeStr}</span>`;
        }
        
        chatList.appendChild(bubble);
    });

    // 스크롤 맨 아래로
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('chatContainer');
    container.scrollTop = container.scrollHeight;
}

// 메시지 전송
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !currentFile) return;

    sendBtn.disabled = true;
    const token = localStorage.getItem('accessToken');
    let fileUrl = null;

    try {
        // 1. 파일 업로드
        if (currentFile) {
            // S3 Presigned URL 요청
            const presignRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'get_presigned_url', 
                    userId: userId, // 토큰 실패 대비
                    data: { fileName: currentFile.name, fileType: currentFile.type, folder: 'chat' } 
                })
            });
            const { uploadUrl, fileUrl: s3Url } = await presignRes.json();
            
            // S3 업로드
            await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': currentFile.type }, body: currentFile });
            fileUrl = s3Url;
        }

        // 2. 메시지 저장
        const msgData = {
            id: Date.now().toString(),
            sender: 'user', // 보낸 사람
            text: text,
            file: fileUrl,
            date: new Date().toISOString(),
            isRead: false
        };

        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'save_chat_message', userId, data: { message: msgData } })
        });

        // 초기화 및 리로드
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

// 붙여넣기 핸들러
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