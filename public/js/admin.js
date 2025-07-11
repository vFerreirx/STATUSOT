// Importações corretas no início do arquivo
import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Elementos DOM
const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const mensagem = document.getElementById("mensagem");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const passwordToggle = document.getElementById("passwordToggle");

// Alternar visibilidade da senha
passwordToggle.addEventListener('click', () => {
  const type = password.getAttribute('type') === 'password' ? 'text' : 'password';
  password.setAttribute('type', type);
  passwordToggle.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
});

// Submit do formulário
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  btnText.textContent = "Autenticando...";
  btnSpinner.classList.remove("hidden");
  
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth, 
      email.value.trim(), 
      password.value.trim()
    );
    
    // Armazenar token de autenticação na sessão
    const idToken = await userCredential.user.getIdToken();
    sessionStorage.setItem('firebaseAuthToken', idToken);
    
    window.location.href = "painel.html";
  } catch (error) {
    // Tratamento de erros específicos
    let errorMessage;
    let messageType = 'error';
    
    switch(error.code) {
      case 'auth/invalid-email':
        errorMessage = "E-mail inválido. Por favor, verifique o formato.";
        break;
      case 'auth/user-disabled':
        errorMessage = "Conta desativada. Entre em contato com o suporte.";
        messageType = 'warning';
        break;
      case 'auth/user-not-found':
        errorMessage = "Usuário não encontrado. Verifique seu e-mail.";
        break;
      case 'auth/wrong-password':
        errorMessage = "Senha incorreta. Tente novamente.";
        break;
      case 'auth/too-many-requests':
        errorMessage = "Muitas tentativas. Tente novamente mais tarde.";
        messageType = 'warning';
        break;
      default:
        errorMessage = "Erro ao autenticar. Tente novamente.";
    }
    
    mensagem.textContent = errorMessage;
    mensagem.className = `message-box message-${messageType}`;
    mensagem.style.display = 'block';
    
    // Efeito de shake no formulário
    form.classList.add('animate-shake');
    setTimeout(() => form.classList.remove('animate-shake'), 500);
  } finally {
    btnText.textContent = "Entrar";
    btnSpinner.classList.add("hidden");
  }
});

// Foco automático no campo email
window.onload = () => email.focus();