import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCkPAb4KzY-zApNzd4RW6BAnqtUb422Bh0",
  authDomain: "status-on-time.firebaseapp.com",
  projectId: "status-on-time",
  storageBucket: "status-on-time.appspot.com",
  messagingSenderId: "89519416671",
  appId: "1:89519416671:web:2c01c026187f2643c782ea"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementos DOM
const btnBuscar = document.getElementById("btnBuscar");
const btnLimpar = document.getElementById("btnLimpar");
const resultadoDiv = document.getElementById("resultado");
const campoBuscaInput = document.getElementById("campoBusca");
const resultCount = document.getElementById("resultCount");

// Configuração inicial
document.addEventListener('DOMContentLoaded', () => {
  campoBuscaInput.value = '';
  btnLimpar.classList.add('hidden');
  resultCount.textContent = "Digite sua busca acima";
});

// Botão de limpar
campoBuscaInput.addEventListener('input', () => {
  campoBuscaInput.value = campoBuscaInput.value.replace(/\D/g, '');
  
  if (campoBuscaInput.value.trim() !== '') {
    btnLimpar.classList.remove('hidden');
  } else {
    btnLimpar.classList.add('hidden');
  }
});

btnLimpar.addEventListener('click', () => {
  campoBuscaInput.value = '';
  btnLimpar.classList.add('hidden');
  campoBuscaInput.focus();
  resultadoDiv.innerHTML = `
    <div class="text-center py-6">
      <div class="inline-block p-3 rounded-full bg-gray-100 mb-3">
        <i class="fas fa-search text-gray-400 text-2xl"></i>
      </div>
      <p class="text-gray-500 text-sm">Digite seu CPF, CNPJ ou número da nota fiscal para localizar sua entrega</p>
    </div>
  `;
  resultCount.textContent = "Digite sua busca acima";
});

// Buscar ao pressionar Enter
campoBuscaInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnBuscar.click();
  }
});

// Função principal de busca
btnBuscar.addEventListener("click", async () => {
  const valorBusca = campoBuscaInput.value.trim();
  
  if (!valorBusca) {
    showAlert("Por favor, informe seu CPF, CNPJ ou número da nota fiscal.", 'error');
    return;
  }
  
  // Mostrar loading
  showLoading();
  
  try {
    // Busca por CPF/CNPJ
    const q = query(collection(db, "entregas"), 
      where("cpfCnpj", "==", valorBusca));
    
    const snapshot = await getDocs(q);
    
    // Processa os resultados
    if (snapshot.empty) {
      // Se não encontrou por CPF, busca por nota fiscal
      const q2 = query(collection(db, "entregas"), 
        where("notaFiscal", "==", valorBusca));
      
      const snapshot2 = await getDocs(q2);
      
      if (snapshot2.empty) {
        showAlert("Nenhuma entrega encontrada com os dados informados.", 'error');
        resultCount.textContent = "0 resultados encontrados";
        return;
      }
      
      resultadoDiv.innerHTML = "";
      snapshot2.forEach(doc => {
        displayEntrega(doc.data());
      });
      
      resultCount.textContent = `${snapshot2.size} ${snapshot2.size === 1 ? 'resultado' : 'resultados'} encontrados`;
    } else {
      resultadoDiv.innerHTML = "";
      snapshot.forEach(doc => {
        displayEntrega(doc.data());
      });
      
      resultCount.textContent = `${snapshot.size} ${snapshot.size === 1 ? 'resultado' : 'resultados'} encontrados`;
    }
  } catch (error) {
    console.error("Erro ao buscar entregas:", error);
    showAlert(`Erro ao buscar entregas: ${error.message}`, 'error');
    resultCount.textContent = "0 resultados encontrados";
  }
});

// Funções para os botões de ação
function imprimirDetalhes() {
  window.print();
}

function abrirWhatsApp() {
  const numero = "5519974098323";
  const texto = "Olá, gostaria de informações sobre minha entrega.";
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
}

function mostrarAjuda() {
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to=sac@otlog.com.br', '_blank');
}


function displayEntrega(entrega) {
    const statusInfo = getStatusInfo(entrega.status);
    
    // Função para formatar datas de diferentes tipos
    const formatarData = (campo, mostrarHora = false) => {
        try {
            if (!campo) return "Não disponível";
            
            let data;
            
            // Se for string no formato YYYY-MM-DD
            if (typeof campo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(campo)) {
                data = new Date(campo + 'T12:00:00'); // Adiciona meio-dia para evitar problemas de fuso
            } 
            // Outros formatos (Timestamp, Date, etc)
            else if (campo.toDate) {
                data = campo.toDate();
            } else if (campo instanceof Date) {
                data = campo;
            } else if (typeof campo === 'string') {
                data = new Date(campo);
            }
            
            // Formata se for uma data válida
            if (data && !isNaN(data.getTime())) {
                const options = {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                };
                
                if (mostrarHora) {
                    options.hour = '2-digit';
                    options.minute = '2-digit';
                }
                
                return data.toLocaleDateString('pt-BR', options);
            }
        } catch (error) {
            console.error("Erro ao formatar data:", error);
        }
        return "Não disponível";
    };

    // Formata as datas
    const dataCriacao = formatarData(entrega.criadoEm, true);
    const previsaoEntrega = entrega.previsaoEntrega 
        ? formatarData(entrega.previsaoEntrega) 
        : "A definir";
  
  const resultCard = document.createElement('div');
  resultCard.className = `fade-in compact-card mb-3`;
  resultCard.innerHTML = `
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <!-- Cabeçalho do status -->
      <div class="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b status-header">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-full bg-white shadow flex items-center justify-center w-10 h-10">
              ${statusInfo.icon}
            </div>
            <div>
              <h2 class="text-lg font-bold text-gray-800">${entrega.destinatario}</h2>
              <div class="mt-1">
                <span class="status-badge ${statusInfo.badgeClass}">
                  ${statusInfo.label}
                </span>
              </div>
            </div>
          </div>
            <div class="text-xs text-gray-500 mt-2 sm:mt-0">
              <i class="fas fa-calendar-alt mr-1"></i>${dataCriacao}
            </div>
            </div>
          </div>

      <!-- Botões de ação -->
      <div class="p-2 bg-gray-50 flex justify-around">
        <button onclick="mostrarAjuda()" class="action-btn text-primary font-medium hover:underline flex items-center bg-gray-100 hover:bg-gray-200">
          <i class="fas fa-question-circle info-icon mr-1"></i>Ajuda
        </button>
        <button onclick="abrirWhatsApp()" class="action-btn text-white font-medium flex items-center bg-secondary hover:bg-[#9c7d4f]">
          <i class="fas fa-headset mr-1"></i>Contato
        </button>
      </div>
      
      <!-- Detalhes simplificados -->
      <div class="p-4">
        <div class="prevision-card flex items-center gap-3">
          <div class="prevision-icon">
            <i class="fas fa-calendar-day"></i>
              </div>
            <div>
              <div class="prevision-text">Previsão de entrega</div>
              <div class="prevision-date">${previsaoEntrega}</div>
            </div>
        </div>
        
        <div class="grid-2-col">
          <div class="info-card">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center">
              <i class="fas fa-user info-icon mr-2"></i>Destinatário
            </h3>
            <p class="font-semibold text-gray-800 text-sm">${entrega.destinatario}</p>
          </div>
          
          <div class="info-card">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center">
              <i class="fas fa-file-invoice info-icon mr-2"></i>Nota Fiscal
            </h3>
            <p class="font-semibold text-gray-800 text-sm">${entrega.notaFiscal}</p>
          </div>
          
          <div class="info-card">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center">
              <i class="fas fa-id-card info-icon mr-2"></i>CPF/CNPJ
            </h3>
            <p class="font-semibold text-gray-800 text-sm">${formatCpfCnpj(entrega.cpfCnpj)}</p>
          </div>
          
          <div class="info-card">
            <h3 class="font-semibold text-gray-700 mb-2 flex items-center">
              <i class="fas fa-map-marker-alt info-icon mr-2"></i>Endereço
            </h3>
            <p class="font-semibold text-gray-800 text-xs">${entrega.rua}, Nº ${entrega.numero}</p>
            <p class="font-semibold text-gray-800 text-xs">${entrega.bairro}, ${entrega.cidade}${entrega.uf ? '/' + entrega.uf : ''}</p>
          </div>
        </div>
        
        <div class="info-card mt-3">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-gray-700 flex items-center">
              <i class="fas fa-sync-alt info-icon mr-2"></i>Status Atual
            </h3>
            <div class="flex items-center">
              <span class="status-indicator ${statusInfo.indicatorClass}"></span>
              <span class="font-bold text-sm">${statusInfo.label}</span>
            </div>
          </div>
          <p class="text-gray-700 text-sm">${getStatusDescription(entrega.status)}</p>
        </div>
      </div>
    </div>
  `;
  resultadoDiv.appendChild(resultCard);
}

// Descrição do status
function getStatusDescription(status) {
  switch(status) {
    case "PEDIDO CADASTRADO":
      return "Seu pedido foi registrado no sistema e em breve será processado.";
    case "AGUARDANDO COLETA":
      return "Aguardando a coleta do produto no ponto de origem.";
    case "AGUARDANDO DOCUMENTAÇÃO":
      return "Falta documentação para prosseguir (nota fiscal ou comprovantes).";
    case "AGUARDANDO DESPACHO":
      return "Pedido pronto e aguardando liberação para despacho.";
    case "CARGA EM ROTA DE ENTREGA":
      return "Sua encomenda está em rota de entrega e deve chegar em breve.";
    case "CARGA EM TRANSITO":
      return "Sua encomenda está em trânsito para a região de destino.";
    case "CARGA SIMULTANEA CONCLUIDA":
      return "Entrega simultânea foi concluída com sucesso.";
    case "CARGA ENDEREÇO ALTERADO":
      return "O endereço de entrega foi alterado conforme solicitação.";
    case "CARGA COM COLETA FINALIZADA":
      return "Coleta do produto foi finalizada com sucesso.";
    case "CARGA COM ENTREGA FINALIZADA":
      return "Entrega foi concluída com sucesso.";
    case "CARGA OPERAÇÃO CONCLUIDA":
      return "Operação de entrega foi concluída.";
    case "CARGA COM OCORRENCIA":
      return "Houve uma ocorrência durante a entrega. Entre em contato para mais informações.";
    case "CARGA COM EXTRAVIO":
      return "Infelizmente houve um extravio da encomenda. Entre em contato para resolver.";
    case "CARGA COM TRANSITO ALTERADO":
      return "A rota de trânsito foi alterada devido a imprevistos.";
    default:
      return "Status da entrega atualizado.";
  }
}

// Mapeamento dos status
function getStatusInfo(status) {
  switch (status) {
    case "PEDIDO CADASTRADO":
      return {
        label: "PEDIDO CADASTRADO",
        icon: '<i class="fas fa-clipboard-list text-indigo-700 text-lg"></i>',
        badgeClass: "bg-indigo-100 text-indigo-800",
        indicatorClass: "bg-indigo-500"
      };
    case "AGUARDANDO COLETA":
      return {
        label: "AGUARDANDO COLETA",
        icon: '<i class="fas fa-hand-holding text-blue-700 text-lg"></i>',
        badgeClass: "bg-blue-100 text-blue-800",
        indicatorClass: "bg-blue-500"
      };
    case "AGUARDANDO DOCUMENTAÇÃO":
      return {
        label: "AGUARDANDO DOCUMENTAÇÃO",
        icon: '<i class="fas fa-file-alt text-yellow-700 text-lg"></i>',
        badgeClass: "bg-yellow-100 text-yellow-800",
        indicatorClass: "bg-yellow-500"
      };
    case "AGUARDANDO DESPACHO":
      return {
        label: "AGUARDANDO DESPACHO",
        icon: '<i class="fas fa-warehouse text-teal-700 text-lg"></i>',
        badgeClass: "bg-teal-100 text-teal-800",
        indicatorClass: "bg-teal-500"
      };
    case "CARGA EM ROTA DE ENTREGA":
      return {
        label: "EM ROTA DE ENTREGA",
        icon: '<i class="fas fa-route text-blue-700 text-lg"></i>',
        badgeClass: "bg-blue-100 text-blue-800",
        indicatorClass: "bg-blue-600"
      };
    case "CARGA EM TRANSITO":
      return {
        label: "EM TRÂNSITO",
        icon: '<i class="fas fa-shipping-fast text-primary text-lg"></i>',
        badgeClass: "bg-blue-100 text-blue-800",
        indicatorClass: "bg-blue-600"
      };
    case "CARGA SIMULTANEA CONCLUIDA":
      return {
        label: "SIMULTANEA CONCLUÍDA",
        icon: '<i class="fas fa-check-double text-green-700 text-lg"></i>',
        badgeClass: "bg-green-100 text-green-800",
        indicatorClass: "bg-green-600"
      };
    case "CARGA ENDEREÇO ALTERADO":
      return {
        label: "ENDEREÇO ALTERADO",
        icon: '<i class="fas fa-map-marker-alt text-orange-700 text-lg"></i>',
        badgeClass: "bg-orange-100 text-orange-800",
        indicatorClass: "bg-orange-500"
      };
    case "CARGA COM COLETA FINALIZADA":
      return {
        label: "COLETADA FINALIZADA",
        icon: '<i class="fas fa-box-open text-green-600 text-lg"></i>',
        badgeClass: "bg-green-100 text-green-800",
        indicatorClass: "bg-green-600"
      };
    case "CARGA COM ENTREGA FINALIZADA":
      return {
        label: "ENTREGA FINALIZADA",
        icon: '<i class="fas fa-check-circle text-green-700 text-lg"></i>',
        badgeClass: "bg-green-100 text-green-800",
        indicatorClass: "bg-green-600"
      };
    case "CARGA OPERAÇÃO CONCLUIDA":
      return {
        label: "OPERAÇÃO CONCLUÍDA",
        icon: '<i class="fas fa-flag-checkered text-green-700 text-lg"></i>',
        badgeClass: "bg-green-100 text-green-800",
        indicatorClass: "bg-green-600"
      };
    case "CARGA COM OCORRENCIA":
      return {
        label: "COM OCORRÊNCIA",
        icon: '<i class="fas fa-exclamation-triangle text-red-700 text-lg"></i>',
        badgeClass: "bg-red-100 text-red-800",
        indicatorClass: "bg-red-600"
      };
    case "CARGA COM EXTRAVIO":
      return {
        label: "EXTRAVIADA",
        icon: '<i class="fas fa-exclamation-circle text-red-800 text-lg"></i>',
        badgeClass: "bg-red-100 text-red-800",
        indicatorClass: "bg-red-600"
      };
    case "CARGA COM TRANSITO ALTERADO":
      return {
        label: "ROTA ALTERADA",
        icon: '<i class="fas fa-exchange-alt text-orange-700 text-lg"></i>',
        badgeClass: "bg-orange-100 text-orange-800",
        indicatorClass: "bg-orange-500"
      };
    default:
      return {
        label: "EM PROCESSAMENTO",
        icon: '<i class="fas fa-cog text-gray-500 text-lg"></i>',
        badgeClass: "bg-gray-100 text-gray-800",
        indicatorClass: "bg-gray-500"
      };
  }
}

function showLoading() {
  resultadoDiv.innerHTML = `
    <div class="flex flex-col items-center justify-center py-8">
      <div class="rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary spinner mb-3 flex items-center justify-center">
        <i class="fas fa-spinner text-secondary"></i>
      </div>
      <p class="text-gray-600 font-medium text-sm">Buscando informações...</p>
    </div>
  `;
  resultCount.textContent = "Buscando...";
}

function showAlert(message, type = 'info') {
  const colors = {
    error: {bg: 'bg-red-50', text: 'text-red-700', icon: 'fas fa-exclamation-circle', border: 'border-red-100'},
    info: {bg: 'bg-blue-50', text: 'text-blue-700', icon: 'fas fa-info-circle', border: 'border-blue-100'},
    success: {bg: 'bg-green-50', text: 'text-green-700', icon: 'fas fa-check-circle', border: 'border-green-100'}
  };
  
  const style = colors[type] || colors.info;
  
  resultadoDiv.innerHTML = `
    <div class="${style.bg} border ${style.border} rounded-xl p-3">
      <div class="flex items-start">
        <i class="${style.icon} ${style.text} mt-0.5 mr-2"></i>
        <div>
          <p class="${style.text} font-medium text-sm">${message}</p>
          <p class="text-gray-600 text-xs mt-1">Verifique se os dados estão corretos e tente novamente.</p>
        </div>
      </div>
    </div>
  `;
  resultCount.textContent = "0 resultados encontrados";
}

// Função para formatar CPF/CNPJ
function formatCpfCnpj(value) {
  if (!value) return '';
  
  // Remove qualquer formatação existente
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length === 11) {
    // Formata CPF: 000.000.000-00
    return cleanValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (cleanValue.length === 14) {
    // Formata CNPJ: 00.000.000/0000-00
    return cleanValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  
  // Retorna o valor original se não for CPF nem CNPJ
  return value;
}

// Torna as funções globais para os botões de ação
window.abrirWhatsApp = abrirWhatsApp;
window.mostrarAjuda = mostrarAjuda;