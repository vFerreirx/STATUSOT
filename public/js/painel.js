import { db, auth } from './firebase-config.js';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, getDoc, query, where, orderBy, limit, startAfter, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Elementos DOM
const lista = document.getElementById("lista-entregas");
const form = document.getElementById("formEntrega");
const formTitulo = document.getElementById("formTitulo");
const btnSalvar = document.getElementById("btnSalvar");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");
const btnCarregarMais = document.getElementById("btnCarregarMais");
const contador = document.getElementById("contador");
const modal = document.getElementById("confirmModal");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");
const importIndicator = document.getElementById("importIndicator");
const fileInput = document.getElementById("fileInput");
const buscaCpfCnpj = document.getElementById("buscaCpfCnpj");
const buscaNotaFiscal = document.getElementById("buscaNotaFiscal");
const btnBuscar = document.getElementById("btnBuscar");
const btnMostrarTodos = document.getElementById("btnMostrarTodos");
const destinatario = document.getElementById("destinatario");
const cpfCnpj = document.getElementById("cpfCnpj");
const rua = document.getElementById("rua");
const numero = document.getElementById("numero");
const bairro = document.getElementById("bairro");
const cidade = document.getElementById("cidade");
const notaFiscal = document.getElementById("notaFiscal");
const statusSelect = document.getElementById("status");
const remetente = document.getElementById("remetente");
const previsaoEntrega = document.getElementById("previsaoEntrega");

// Lista dos novos status de entrega
const statusEntregas = [
  "CARGA EM ROTA DE ENTREGA",
  "CARGA EM TRANSITO",
  "CARGA SIMULTANEA CONCLUIDA",
  "CARGA ENDEREÇO ALTERADO",
  "CARGA COM COLETA FINALIZADA",
  "CARGA COM ENTREGA FINALIZADA",
  "CARGA OPERAÇÃO CONCLUIDA",
  "CARGA COM OCORRENCIA",
  "CARGA COM EXTRAVIO",
  "CARGA COM TRANSITO ALTERADO"
];

// Variáveis de estado
let editId = null;
let lastDoc = null;
const LIMITE = 10;
let deleteId = null;
let currentFilters = { cpf: "", nf: "" };
let importedData = null;
let isSearching = false;

// Função para exibir toast
function showToast(message, type = "info") {
  if (!toastMessage || !toast) return;
  toastMessage.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Função simplificada para validação de CPF/CNPJ
const validarCPFCnpj = (valor) => {
  valor = valor.replace(/\D/g, '');
  return valor.length === 11 || valor.length === 14;
};

// Função para ler o arquivo XML
const parseXML = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(e.target.result, "text/xml");

        const errors = xmlDoc.getElementsByTagName("parsererror");
        if (errors.length > 0) {
          throw new Error("XML malformado ou inválido");
        }

        const nfeProc = xmlDoc.getElementsByTagName("nfeProc")[0];
        if (!nfeProc) {
          throw new Error("Formato de XML inválido: nfeProc não encontrado.");
        }

        const infNFe = nfeProc.getElementsByTagName("infNFe")[0];
        const dest = infNFe.getElementsByTagName("dest")[0];
        const ide = infNFe.getElementsByTagName("ide")[0];
        
        const enderDest = dest ? dest.getElementsByTagName("enderDest")[0] : null;
        const emit = infNFe.getElementsByTagName("emit")[0];

        const getValue = (parent, tag) => {
          if (!parent) return "";
          const el = parent.getElementsByTagName(tag)[0];
          return el ? el.textContent.trim() : "";
        };

        const destinatario = getValue(dest, "xNome");
        const cpf = getValue(dest, "CPF");
        const cnpj = getValue(dest, "CNPJ");
        const cpfCnpj = cpf || cnpj || "";
        const rua = getValue(enderDest, "xLgr");
        const numero = getValue(enderDest, "nro");
        const bairro = getValue(enderDest, "xBairro");
        const cidade = getValue(enderDest, "xMun");
        const notaFiscal = getValue(ide, "nNF");

        // Extrair dados do remetente
        let remetente = "";
        if (emit) {
          const nomeRemetente = getValue(emit, "xNome");
          const cidadeRemetente = getValue(emit.getElementsByTagName("enderEmit")[0], "xMun");
          remetente = `${nomeRemetente}${cidadeRemetente ? ' - ' + cidadeRemetente : ''}`;
        }

        const result = {
          destinatario: destinatario || "",
          cpfCnpj: cpfCnpj || "",
          rua: rua || "",
          numero: numero || "",
          bairro: bairro || "",
          cidade: cidade || "",
          notaFiscal: notaFiscal || "",
          status: "CARGA EM ROTA DE ENTREGA",
          remetente: remetente || ""
        };

        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

// Funções auxiliares
const limparFormulario = () => {
  if (!form) return;
  form.reset();
  if (statusSelect) statusSelect.value = "CARGA EM ROTA DE ENTREGA";
  editId = null;
  importedData = null;
  if (formTitulo) formTitulo.textContent = "Cadastrar Nova Entrega";
  if (btnText) btnText.innerHTML = `<i data-lucide="save" class="w-5 h-5 mr-2"></i> Salvar Entrega`;
  if (importIndicator) importIndicator.classList.add("hidden");
  lucide.createIcons();
};

const criarBadge = (status) => {
  const statusClasses = {
    "CARGA EM ROTA DE ENTREGA": { indicator: "bg-blue-500", badge: "bg-blue-100 text-blue-800" },
    "CARGA EM TRANSITO": { indicator: "bg-purple-500", badge: "bg-purple-100 text-purple-800" },
    "CARGA SIMULTANEA CONCLUIDA": { indicator: "bg-green-500", badge: "bg-green-100 text-green-800" },
    "CARGA ENDEREÇO ALTERADO": { indicator: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800" },
    "CARGA COM COLETA FINALIZADA": { indicator: "bg-cyan-500", badge: "bg-cyan-100 text-cyan-800" },
    "CARGA COM ENTREGA FINALIZADA": { indicator: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-800" },
    "CARGA OPERAÇÃO CONCLUIDA": { indicator: "bg-green-500", badge: "bg-green-100 text-green-800" },
    "CARGA COM OCORRENCIA": { indicator: "bg-red-500", badge: "bg-red-100 text-red-800" },
    "CARGA COM EXTRAVIO": { indicator: "bg-gray-500", badge: "bg-gray-100 text-gray-800" },
    "CARGA COM TRANSITO ALTERADO": { indicator: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800" }
  };

  const classes = statusClasses[status] || {
    indicator: "bg-gray-500",
    badge: "bg-gray-100 text-gray-800"
  };
  
  return `
    <div class="flex items-center">
      <span class="w-3 h-3 rounded-full mr-2 ${classes.indicator}"></span>
      <span class="px-2 py-1 rounded-full text-xs font-medium ${classes.badge}">
        ${status}
      </span>
    </div>
  `;
};

// Funções principais
const carregarEntregas = async (reset = true) => {
  if (!lista) return;
  
  if (reset) {
    lista.innerHTML = '<tr><td colspan="7" class="text-center py-8"><div class="spinner-container"><div class="spinner-lg"></div></div></td></tr>';
    lastDoc = null;
    if (btnCarregarMais) btnCarregarMais.classList.add('hidden');
    isSearching = true;
    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.innerHTML = '<i data-lucide="search" class="w-4 h-4 mr-2"></i> Buscando <span class="search-loading"></span>';
    }
    lucide.createIcons();
  }

  try {
    let q;
    
    // Construção da query
    if (currentFilters.cpf && currentFilters.nf) {
      q = query(
        collection(db, "entregas"),
        where("cpfCnpj", "==", currentFilters.cpf),
        where("notaFiscal", "==", currentFilters.nf),
        orderBy("criadoEm", "desc"),
        limit(LIMITE)
      );
    } else if (currentFilters.cpf) {
      q = query(
        collection(db, "entregas"),
        where("cpfCnpj", "==", currentFilters.cpf),
        orderBy("criadoEm", "desc"),
        limit(LIMITE)
      );
    } else if (currentFilters.nf) {
      q = query(
        collection(db, "entregas"),
        where("notaFiscal", "==", currentFilters.nf),
        orderBy("criadoEm", "desc"),
        limit(LIMITE)
      );
    } else {
      q = query(
        collection(db, "entregas"),
        orderBy("criadoEm", "desc"),
        limit(LIMITE)
      );
    }
    
    if (lastDoc && !reset) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    
    if (reset) {
      lista.innerHTML = '';
    }

    if (snapshot.empty) {
      if (reset) {
        lista.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-500">Nenhuma entrega encontrada.</td></tr>';
      }
      if (btnCarregarMais) btnCarregarMais.classList.add('hidden');
      return;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (btnCarregarMais) btnCarregarMais.classList.toggle('hidden', snapshot.docs.length < LIMITE);

    snapshot.forEach(docSnap => {
      const d = docSnap.data();
      const id = docSnap.id;
      const endereco = `${d.rua || ""}, ${d.numero || ""} - ${d.bairro || ""}, ${d.cidade || ""}`;

      let previsaoFormatada = "-";
      if (d.previsaoEntrega) {
        const dataPrevisao = d.previsaoEntrega.toDate ? d.previsaoEntrega.toDate() : new Date(d.previsaoEntrega);
        previsaoFormatada = dataPrevisao.toLocaleDateString('pt-BR');
      }

      const tr = document.createElement("tr");
      tr.className = "table-row";
      tr.innerHTML = `
        <td class="px-6 py-4" data-label="Remetente">
          <div class="text-sm font-medium text-gray-900">${d.remetente || "-"}</div>
        </td>
        <td class="px-6 py-4" data-label="Destinatário">
          <div class="font-medium">${d.destinatario || "-"}</div>
          <div class="text-sm text-gray-500">${d.criadoEm?.toDate().toLocaleDateString() || ""}</div>
        </td>
        <td class="px-6 py-4" data-label="CPF/CNPJ">${d.cpfCnpj || "-"}</td>
        <td class="px-6 py-4" data-label="Nota Fiscal">${d.notaFiscal || "-"}</td>
        <td class="px-6 py-4" data-label="Endereço">${endereco}</td>
        <td class="px-6 py-4" data-label="Status">${criarBadge(d.status)}</td>
        <td class="px-6 py-4 text-center" data-label="Ações">
          <div class="flex justify-center gap-2">
            <button data-id="${id}" class="action-btn edit">
              <i data-lucide="edit" class="w-4 h-4"></i>
            </button>
            <button data-id="${id}" class="action-btn delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      `;
      lista.appendChild(tr);
    });

    if (contador) contador.textContent = `Mostrando ${lista.children.length} ${lista.children.length === 1 ? 'entrega' : 'entregas'}`;
    lucide.createIcons();

    // Configurar eventos dos botões
    document.querySelectorAll(".action-btn.delete").forEach(btn => {
      btn.onclick = (e) => {
        deleteId = e.currentTarget.dataset.id;
        if (modal) modal.classList.remove('hidden');
      };
    });

    document.querySelectorAll(".action-btn.edit").forEach(btn => {
      btn.onclick = async (e) => {
        const id = e.currentTarget.dataset.id;
        const snap = await getDoc(doc(db, "entregas", id));

        if (snap.exists()) {
          const d = snap.data();
          if (remetente) remetente.value = d.remetente || "";
          if (destinatario) destinatario.value = d.destinatario || "";
          if (cpfCnpj) cpfCnpj.value = d.cpfCnpj || "";
          if (rua) rua.value = d.rua || "";
          if (numero) numero.value = d.numero || "";
          if (bairro) bairro.value = d.bairro || "";
          if (cidade) cidade.value = d.cidade || "";
          if (notaFiscal) notaFiscal.value = d.notaFiscal || "";
          if (statusSelect) statusSelect.value = d.status || "CARGA EM ROTA DE ENTREGA";

          if (d.previsaoEntrega) {
            const dataPrevisao = d.previsaoEntrega.toDate ? d.previsaoEntrega.toDate() : new Date(d.previsaoEntrega);
            if (previsaoEntrega) previsaoEntrega.value = dataPrevisao.toISOString().split('T')[0];
          } else {
            if (previsaoEntrega) previsaoEntrega.value = "";
          }
              
          editId = id;
          if (formTitulo) formTitulo.textContent = "Editando Entrega";
          if (btnText) btnText.innerHTML = `<i data-lucide="save" class="w-5 h-5 mr-2"></i> Atualizar Entrega`;
          lucide.createIcons();
          window.scrollTo({ top: 0, behavior: "smooth" });
          showToast("Entrega carregada para edição", "success");
        }
      };
    });

  } catch (error) {
    console.error("Erro ao carregar entregas:", error);
    if (lista) lista.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-red-500">Erro ao carregar dados.</td></tr>';
    showToast("Erro ao carregar entregas: " + error.message, "error");
  } finally {
    isSearching = false;
    if (btnBuscar) {
      btnBuscar.disabled = false;
      btnBuscar.innerHTML = '<i data-lucide="search" class="w-4 h-4 mr-2"></i> Buscar';
    }
    lucide.createIcons();
  }
};

// Função para escapar vírgulas e aspas nos dados
function escapeCSV(str) {
  if (str === null || str === undefined) return '""';
  return `"${str.toString().trim().replace(/"/g, '""')}"`;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Configurar logout
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    auth.signOut().then(() => {
      window.location.href = 'admin.html';
    });
  });

  // Botão de rastreamento
  document.getElementById('btnRastrear')?.addEventListener('click', () => {
    window.location.href = 'status.html';
  });

  // Configurar modal
  document.getElementById('modalCancel')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  
  document.getElementById('modalConfirm')?.addEventListener('click', async () => {
    modal.classList.add('hidden');
    if (deleteId) {
      try {
        await deleteDoc(doc(db, "entregas", deleteId));
        showToast("Entrega excluída com sucesso!", "success");
        if (editId === deleteId) limparFormulario();
        carregarEntregas();
        deleteId = null;
      } catch (error) {
        showToast(`Erro ao excluir: ${error.message}`, "error");
      }
    }
  });

  // Máscara para CPF/CNPJ
  if (cpfCnpj) {
    cpfCnpj.addEventListener('input', function(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d)/, '$1.$2')
                    .replace(/(\d{3})(\d{1,2})/, '$1-$2');
      } else {
        value = value.replace(/^(\d{2})(\d)/, '$1.$2')
                    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
                    .replace(/\.(\d{3})(\d)/, '.$1/$2')
                    .replace(/(\d{4})(\d)/, '$1-$2');
      }
      e.target.value = value;
    });
  }

  // Event listener para o botão de importar
  document.getElementById("btnImportar")?.addEventListener("click", () => {
    fileInput.click();
  });

  // Event listener para limpar formulário
  document.getElementById("btnLimparForm")?.addEventListener("click", () => {
    limparFormulario();
    showToast("Formulário limpo", "success");
  });

  // Event listener para importação de arquivo
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const loading = document.createElement("div");
        loading.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
        loading.innerHTML = `
          <div class="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 class="text-xl font-bold mb-4">Importando XML</h3>
            <p class="mb-4">Processando arquivo, por favor aguarde...</p>
            <div class="flex justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        `;
        document.body.appendChild(loading);
        
        importedData = await parseXML(file);
        
        // Preencher formulário com dados importados
        if (destinatario) destinatario.value = importedData.destinatario || "";
        if (cpfCnpj) cpfCnpj.value = importedData.cpfCnpj || "";
        if (rua) rua.value = importedData.rua || "";
        if (numero) numero.value = importedData.numero || "";
        if (bairro) bairro.value = importedData.bairro || "";
        if (cidade) cidade.value = importedData.cidade || "";
        if (notaFiscal) notaFiscal.value = importedData.notaFiscal || "";
        if (statusSelect) statusSelect.value = importedData.status || "CARGA EM ROTA DE ENTREGA";
        if (remetente) remetente.value = importedData.remetente || "";
        if (previsaoEntrega) previsaoEntrega.value = "";
        
        if (importIndicator) importIndicator.classList.remove("hidden");
        if (formTitulo) formTitulo.textContent = "Dados Importados - Revise e Salve";
        
        document.body.removeChild(loading);
        showToast("Dados do XML carregados no formulário. Revise e clique em Salvar.", "success");
        
      } catch (error) {
        console.error("Erro ao importar XML:", error);
        showToast(`Erro ao importar XML: ${error.message}`, "error");
        document.body.querySelector(".fixed")?.remove();
      } finally {
        e.target.value = "";
      }
    });
  }

  // Confirmar antes de sair com formulário preenchido
  window.addEventListener('beforeunload', (e) => {
    if (editId || (destinatario && destinatario.value) || (cpfCnpj && cpfCnpj.value)) {
      e.preventDefault();
      e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
    }
  });

  // Configurar o listener do formulário
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Verificação de segurança extra
      const elementos = {
        destinatario, cpfCnpj, rua, numero, bairro, cidade, 
        notaFiscal, statusSelect, remetente, previsaoEntrega
      };
      
      for (const [nome, elemento] of Object.entries(elementos)) {
        if (!elemento) {
          console.error(`Elemento ${nome} não encontrado!`);
          showToast("Erro interno no formulário. Recarregue a página.", "error");
          return;
        }
      }
        
      // Coletar dados
      const dados = {
        remetente: remetente.value.trim(),
        destinatario: destinatario.value.trim(),
        cpfCnpj: cpfCnpj.value.replace(/\D/g, '').trim(),
        rua: rua.value.trim(),
        numero: numero.value.trim(),
        bairro: bairro.value.trim(),
        cidade: cidade.value.trim(),
        notaFiscal: notaFiscal.value.trim(),
        status: statusSelect.value,
        previsaoEntrega: previsaoEntrega.value || null
      };

      // Validação
      if (!dados.remetente || !dados.destinatario || !dados.cpfCnpj) {
        showToast("Remetente, destinatário e CPF/CNPJ são obrigatórios", "warning");
        return;
      }

      if (!validarCPFCnpj(dados.cpfCnpj)) {
        showToast("CPF/CNPJ inválido", "warning");
        return;
      }

      if (!statusEntregas.includes(dados.status)) {
        showToast("Status de entrega inválido", "warning");
        return;
      }

      // Estado de carregamento
      if (btnText) btnText.innerHTML = editId ? "Atualizando..." : "Salvando...";
      if (btnSpinner) btnSpinner.classList.remove("hidden");
      if (btnSalvar) btnSalvar.disabled = true;

      try {
        if (editId) {
          const docRef = doc(db, "entregas", editId);
          const historico = {
            data: new Date(),
            usuario: auth.currentUser.email,
            alteracoes: [`Status alterado para ${dados.status}`]
          };
          
          await updateDoc(docRef, { 
            ...dados,
            historico: arrayUnion(historico) 
          });
          
          showToast("Entrega atualizada com sucesso!", "success");
        } else {
          await addDoc(collection(db, "entregas"), {
            ...dados,
            criadoEm: new Date(),
            criadoPor: auth.currentUser.email,
            historico: [{
              data: new Date(),
              usuario: auth.currentUser.email,
              alteracoes: ["Cadastro inicial"]
            }]
          });
          showToast("Entrega cadastrada com sucesso!", "success");
          
          if (importedData) {
            importedData = null;
            if (importIndicator) importIndicator.classList.add("hidden");
          }
        }

        limparFormulario();
        carregarEntregas();
      } catch (error) {
        console.error("Erro ao salvar:", error);
        showToast(`Erro ao ${editId ? 'atualizar' : 'salvar'}: ${error.message}`, "error");
      } finally {
        if (btnSpinner) btnSpinner.classList.add("hidden");
        if (btnSalvar) btnSalvar.disabled = false;
        if (btnText) btnText.innerHTML = editId ? "Atualizar Entrega" : "Salvar Entrega";
      }
    });
  }

  // Configurar outros listeners
  if (btnBuscar) {
    btnBuscar.addEventListener("click", () => {
      currentFilters.cpf = buscaCpfCnpj ? buscaCpfCnpj.value.trim() : "";
      currentFilters.nf = buscaNotaFiscal ? buscaNotaFiscal.value.trim() : "";
            
      if (!currentFilters.cpf && !currentFilters.nf) {
        showToast("Digite CPF/CNPJ ou Nota Fiscal para buscar", "warning");
        return;
      }
            
      carregarEntregas(true);
    });
  }

  if (btnMostrarTodos) {
    btnMostrarTodos.addEventListener("click", () => {
      if (buscaCpfCnpj) buscaCpfCnpj.value = "";
      if (buscaNotaFiscal) buscaNotaFiscal.value = "";
      currentFilters.cpf = "";
      currentFilters.nf = "";
      carregarEntregas(true);
      showToast("Mostrando todas as entregas", "success");
    });
  }

  if (btnCarregarMais) {
    btnCarregarMais.addEventListener("click", () => {
      carregarEntregas(false);
    });
  }

  const btnExportar = document.getElementById("btnExportar");
  if (btnExportar) {
    btnExportar.onclick = async () => {
      if (!lista) return;
      const rows = Array.from(lista.querySelectorAll("tr")).filter(tr => !tr.innerHTML.includes('Nenhuma'));
      if (rows.length === 0) {
        showToast("Nenhum dado para exportar", "warning");
        return;
      }

      // Cabeçalhos do CSV
      const headers = [
        "Remetente",
        "Destinatario",
        "CPF/CNPJ",
        "Nota Fiscal",
        "Endereco",
        "Status",
        "PrevisaoEntrega"
      ];

      // Mapeia os dados das linhas
      const data = rows.map(tr => {
        const tds = tr.querySelectorAll("td");
        return [
          escapeCSV(tds[0].textContent),
          escapeCSV(tds[1].querySelector('.font-medium').textContent),
          escapeCSV(tds[2].textContent),
          escapeCSV(tds[3].textContent),
          escapeCSV(tds[4].textContent),
          escapeCSV(tds[5].textContent.replace(/<\/?[^>]+(>|$)/g, ""))
        ];
      });

      // Junta cabeçalhos e dados
      let csv = [
        headers.join(','),
        ...data.map(row => row.join(','))
      ].join('\r\n');

      // Cria o arquivo
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
            
      // Download
      const link = document.createElement("a");
      link.href = url;
      link.download = `entregas_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Exportação concluída com sucesso!", "success");
    };
  }

  // Inicializar a aplicação
  console.log("Elementos DOM:", {
    destinatario,
    cpfCnpj,
    rua,
    numero,
    bairro,
    cidade,
    notaFiscal,
    statusSelect,
    remetente,
    previsaoEntrega
  });
  
  carregarEntregas();
  lucide.createIcons();
});