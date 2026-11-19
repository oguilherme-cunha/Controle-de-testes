(function () {
  const $ = (id) => document.getElementById(id);
  let testes = []; // casos de teste carregados do Supabase

  // ============================================================
  //  Utilitários
  // ============================================================
  const STATUS = {
    aprovado:  { label: "Aprovado",  cor: "var(--aprovado)" },
    reprovado: { label: "Reprovado", cor: "var(--reprovado)" },
    pendente:  { label: "Pendente",  cor: "var(--pendente)" },
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const txt = (v) => String(v ?? "").trim();

  // status fora da lista (ex.: "" ou "bloqueado") é tratado como pendente
  const statusDe = (t) => (STATUS[t.status] ? t.status : "pendente");
  const areaDe = (t) => txt(t.area) || "Sem área";
  const moduloDe = (t) => txt(t.modulo) || "Sem módulo";
  const realizadorDe = (t) => txt(t.realizador) || "Sem realizador";

  // Considera vazio também textos como "Sem observações" / "sem observacao."
  const temObs = (t) => {
    const o = txt(t.observacoes).toLowerCase().replace(/[.\s]+$/, "");
    return o !== "" && !/^sem observa(ç|c)(ões|oes|ão|ao)$/.test(o);
  };

  const ordenar = (arr) => arr.sort((a, b) => a.localeCompare(b, "pt-BR"));
  const unicos = (arr) => ordenar([...new Set(arr.filter(Boolean))]);

  const lerLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarLS = (k, v) => {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {}
  };

  const paraISO = (br) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(txt(br));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const paraBR = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(txt(iso));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };
  const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 5000);
  }

  // _i = posição do teste em `testes` (usada pelo botão de editar)
  const todos = () => testes.map((t, i) => ({ ...t, _i: i }));

  // ============================================================
  //  Informações gerais: o período vem das datas dos casos
  // ============================================================
  function renderPeriodo() {
    const datas = testes.map((t) => paraISO(t.data)).filter(Boolean).sort();
    $("periodo").textContent = !datas.length
      ? "—"
      : datas[0] === datas.at(-1)
        ? paraBR(datas[0])
        : `${paraBR(datas[0])} a ${paraBR(datas.at(-1))}`;
  }

  // ============================================================
  //  Resumo da execução
  // ============================================================
  const pct = (n, d) => (d ? (n / d) * 100 : 0);

  function renderResumo(lista) {
    const total = lista.length;
    const cont = { aprovado: 0, reprovado: 0, pendente: 0 };
    lista.forEach((t) => cont[statusDe(t)]++);

    $("taxa").textContent = `${Math.round(pct(cont.aprovado, total))}%`;

    let acc = 0;
    const fatias = Object.keys(STATUS)
      .filter((k) => cont[k] > 0)
      .map((k) => {
        const ini = acc;
        acc += pct(cont[k], total);
        return `${STATUS[k].cor} ${ini}% ${acc}%`;
      });
    $("donut").style.background = fatias.length ? `conic-gradient(${fatias.join(",")})` : "var(--border)";

    $("kpis").innerHTML =
      `<div class="kpi"><strong>${total}</strong><span>Total</span></div>` +
      Object.entries(STATUS)
        .map(([k, s]) => `<div class="kpi" style="--c:${s.cor}"><strong>${cont[k]}</strong><span>${s.label}</span></div>`)
        .join("");

    // Por área
    const porArea = {};
    lista.forEach((t) => {
      const a = areaDe(t);
      porArea[a] ??= { total: 0, aprovado: 0, reprovado: 0, pendente: 0 };
      porArea[a].total++;
      porArea[a][statusDe(t)]++;
    });
    $("areas").innerHTML = ordenar(Object.keys(porArea))
      .map((a) => {
        const c = porArea[a];
        const seg = (k) =>
          c[k] ? `<span style="width:${pct(c[k], c.total)}%;background:${STATUS[k].cor}" title="${STATUS[k].label}: ${c[k]}"></span>` : "";
        return `
          <tr>
            <td><button type="button" class="link-area" data-area="${esc(a)}">${esc(a)}</button></td>
            <td><strong>${c.total}</strong></td>
            <td>${c.aprovado}</td>
            <td>${c.reprovado}</td>
            <td>${c.pendente}</td>
            <td class="col-barra">
              <div class="barra">${seg("aprovado")}${seg("reprovado")}${seg("pendente")}</div>
              <small>${Math.round(pct(c.aprovado, c.total))}% aprovado</small>
            </td>
          </tr>`;
      })
      .join("");
  }

  // Clicar numa área do resumo filtra a tabela por ela
  $("areas").addEventListener("click", (e) => {
    const b = e.target.closest(".link-area");
    if (!b) return;
    Object.values(sel).forEach((s) => s.clear());
    sel.area.add(b.dataset.area);
    renderFiltros(true);
    $("tabela").closest("section").scrollIntoView({ behavior: "smooth" });
  });

  // ============================================================
  //  Filtros (multisseleção: OU dentro do mesmo filtro, E entre filtros)
  // ============================================================
  const FILTROS = [
    { campo: "area", label: "Área", valor: areaDe },
    { campo: "modulo", label: "Módulo", valor: moduloDe },
    { campo: "status", label: "Status", valor: statusDe, nome: (v) => STATUS[v].label, ordem: Object.keys(STATUS) },
    { campo: "realizador", label: "Realizador", valor: realizadorDe },
    {
      campo: "obs", label: "Observação",
      valor: (t) => (temObs(t) ? "com" : "sem"),
      nome: (v) => (v === "com" ? "Com observação" : "Sem observação"),
      ordem: ["com", "sem"],
    },
  ];
  const F = Object.fromEntries(FILTROS.map((f) => [f.campo, f]));
  const sel = Object.fromEntries(FILTROS.map((f) => [f.campo, new Set()]));
  const nomeDe = (f, v) => (f.nome ? f.nome(v) : v);

  function passa(t, exceto) {
    const termo = $("busca").value.trim().toLowerCase();
    if (termo) {
      const texto = `${t.titulo} ${areaDe(t)} ${t.modulo} ${t.realizador ?? ""} ${t.observacoes ?? ""}`.toLowerCase();
      if (!texto.includes(termo)) return false;
    }
    return FILTROS.every(
      (f) => f.campo === exceto || !sel[f.campo].size || sel[f.campo].has(f.valor(t))
    );
  }

  // Monta os botões de filtro (uma vez)
  $("filtrosGrupo").innerHTML = FILTROS.map(
    (f) => `
      <div class="filtro" data-campo="${f.campo}">
        <button type="button" class="filtro-btn" aria-expanded="false" aria-haspopup="true">
          ${esc(f.label)} <span class="filtro-cont" hidden></span><span class="seta">▾</span>
        </button>
        <div class="pop" hidden>
          <input type="search" class="pop-busca" placeholder="Filtrar ${esc(f.label.toLowerCase())}…" />
          <div class="pop-opcoes"></div>
          <div class="pop-rodape">
            <button type="button" class="pop-limpar">Limpar</button>
            <button type="button" class="pop-ok">OK</button>
          </div>
        </div>
      </div>`
  ).join("");

  let popAberto = null;
  const filtroEl = (campo) => document.querySelector(`.filtro[data-campo="${campo}"]`);

  function abrirPop(campo) {
    if (popAberto && popAberto !== campo) fecharPop();
    const el = filtroEl(campo);
    el.querySelector(".pop").hidden = false;
    el.querySelector(".filtro-btn").setAttribute("aria-expanded", "true");
    el.querySelector(".pop-busca").value = "";
    popAberto = campo;
    renderOpcoes(campo);
    el.querySelector(".pop-busca").focus();
  }
  function fecharPop() {
    if (!popAberto) return;
    const el = filtroEl(popAberto);
    el.querySelector(".pop").hidden = true;
    el.querySelector(".filtro-btn").setAttribute("aria-expanded", "false");
    popAberto = null;
  }

  function renderOpcoes(campo) {
    const f = F[campo];
    const el = filtroEl(campo);
    const busca = el.querySelector(".pop-busca").value.trim().toLowerCase();
    const lista = todos();
    // contagem considera os outros filtros ativos
    const cont = {};
    lista.filter((t) => passa(t, campo)).forEach((t) => {
      const v = f.valor(t);
      cont[v] = (cont[v] || 0) + 1;
    });
    let valores = f.ordem || unicos(lista.map(f.valor));
    valores = valores.filter((v) => !busca || nomeDe(f, v).toLowerCase().includes(busca));

    el.querySelector(".pop-opcoes").innerHTML = valores.length
      ? valores
          .map(
            (v) => `
          <label class="pop-op${cont[v] ? "" : " zerado"}">
            <input type="checkbox" value="${esc(v)}" ${sel[campo].has(v) ? "checked" : ""} />
            ${campo === "status" ? `<i class="ponto" style="background:${STATUS[v].cor}"></i>` : ""}
            <span class="pop-nome">${esc(nomeDe(f, v))}</span>
            <span class="pop-num">${cont[v] || 0}</span>
          </label>`
          )
          .join("")
      : `<p class="pop-vazio">Nada encontrado.</p>`;
  }

  $("filtrosGrupo").addEventListener("click", (e) => {
    const el = e.target.closest(".filtro");
    if (!el) return;
    const campo = el.dataset.campo;
    if (e.target.closest(".filtro-btn")) {
      popAberto === campo ? fecharPop() : abrirPop(campo);
    } else if (e.target.closest(".pop-limpar")) {
      sel[campo].clear();
      renderFiltros(true);
    } else if (e.target.closest(".pop-ok")) {
      fecharPop();
    }
  });
  $("filtrosGrupo").addEventListener("change", (e) => {
    if (e.target.type !== "checkbox") return;
    const campo = e.target.closest(".filtro").dataset.campo;
    e.target.checked ? sel[campo].add(e.target.value) : sel[campo].delete(e.target.value);
    renderFiltros(true);
  });
  $("filtrosGrupo").addEventListener("input", (e) => {
    if (e.target.classList.contains("pop-busca")) renderOpcoes(e.target.closest(".filtro").dataset.campo);
  });
  document.addEventListener("click", (e) => {
    if (popAberto && !e.target.closest(".filtro")) fecharPop();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popAberto) {
      const btn = filtroEl(popAberto).querySelector(".filtro-btn");
      fecharPop();
      btn.focus();
    }
  });

  $("chips").addEventListener("click", (e) => {
    const c = e.target.closest("[data-campo]");
    if (c) {
      sel[c.dataset.campo].delete(c.dataset.valor);
    } else if (e.target.closest(".chip-limpar")) {
      Object.values(sel).forEach((s) => s.clear());
      $("busca").value = "";
    } else return;
    renderFiltros(true);
  });

  $("busca").addEventListener("input", () => renderFiltros(true));

  // Atualiza botões, chips, popover aberto e tabela.
  // voltarInicio = true quando o filtro mudou (volta para a página 1)
  function renderFiltros(voltarInicio = false) {
    if (voltarInicio) pagina = 1;
    FILTROS.forEach((f) => {
      const n = sel[f.campo].size;
      const el = filtroEl(f.campo);
      const badge = el.querySelector(".filtro-cont");
      badge.hidden = !n;
      badge.textContent = n;
      el.classList.toggle("ativo", n > 0);
    });

    const chips = FILTROS.flatMap((f) =>
      [...sel[f.campo]].map(
        (v) => `<button type="button" class="chip" data-campo="${f.campo}" data-valor="${esc(v)}" title="Remover filtro">
          <span class="chip-rot">${esc(f.label)}:</span> ${esc(nomeDe(f, v))} <span aria-hidden="true">✕</span></button>`
      )
    );
    const temFiltro = chips.length || $("busca").value.trim();
    $("chips").innerHTML =
      chips.join("") + (temFiltro ? `<button type="button" class="chip-limpar">Limpar filtros</button>` : "");

    if (popAberto) renderOpcoes(popAberto);
    renderTabela();
  }

  // ============================================================
  //  Tabela de casos de teste
  // ============================================================
  const POR_PAGINA = 10;
  let pagina = 1;
  let imprimindo = false; // na impressão, mostra todos os casos filtrados

  function renderTabela() {
    const base = todos();
    const lista = base.filter((t) => passa(t));

    $("contagem").textContent =
      lista.length === base.length ? `${base.length} casos` : `${lista.length} de ${base.length} casos (filtrados)`;
    $("vazio").hidden = lista.length > 0;

    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    pagina = Math.min(Math.max(1, pagina), paginas);
    const ini = (pagina - 1) * POR_PAGINA;
    const visiveis = imprimindo ? lista : lista.slice(ini, ini + POR_PAGINA);
    renderPaginacao(lista.length, paginas, ini);

    $("tabela").innerHTML = visiveis
      .map((t) => {
        const s = STATUS[statusDe(t)];
        return `
          <tr class="linha">
            <td>
              ${esc(t.titulo)}
              ${temObs(t) ? `<span class="tag-obs" title="${esc(t.observacoes)}" aria-label="Tem observação">💬</span>` : ""}
            </td>
            <td>${esc(areaDe(t))}</td>
            <td>${esc(t.modulo)}</td>
            <td><span class="badge" style="--c:${s.cor}">${s.label}</span></td>
            <td>${esc(t.data)}</td>
            <td>${esc(t.realizador) || "—"}</td>
            <td class="col-acoes"><button type="button" class="btn-editar" data-editar="${t._i}" title="Editar caso de teste" aria-label="Editar">✎</button></td>
          </tr>
          <tr class="detalhe" hidden><td colspan="7">
            <div class="detalhe-grid">
              <div><h4>Observação</h4><p>${temObs(t) ? esc(t.observacoes) : "Sem observações."}</p></div>
            </div>
          </td></tr>`;
      })
      .join("");
  }

  // Números de página com reticências: 1 … 4 5 6 … 9
  function numerosPagina(atual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const nums = new Set([1, total, atual - 1, atual, atual + 1]);
    if (atual <= 3) [2, 3, 4].forEach((n) => nums.add(n));
    if (atual >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => nums.add(n));
    const ord = [...nums].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    const out = [];
    ord.forEach((n, i) => {
      if (i && n - ord[i - 1] > 1) out.push("…");
      out.push(n);
    });
    return out;
  }

  function renderPaginacao(qtd, paginas, ini) {
    const el = $("paginacao");
    el.hidden = qtd <= POR_PAGINA;
    if (el.hidden) return;
    const fim = Math.min(ini + POR_PAGINA, qtd);
    const btn = (rot, alvo, extra = "") =>
      `<button type="button" class="pag-btn${extra}" data-pagina="${alvo}"${
        extra.includes("atual") ? ' aria-current="page"' : ""
      }>${rot}</button>`;
    el.innerHTML = `
      <span class="pag-info">${ini + 1}–${fim} de ${qtd}</span>
      <div class="pag-botoes">
        <button type="button" class="pag-btn" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""} aria-label="Página anterior">‹ Anterior</button>
        ${numerosPagina(pagina, paginas)
          .map((n) => (n === "…" ? `<span class="pag-reticencias">…</span>` : btn(n, n, n === pagina ? " atual" : "")))
          .join("")}
        <button type="button" class="pag-btn" data-pagina="${pagina + 1}" ${pagina === paginas ? "disabled" : ""} aria-label="Próxima página">Próxima ›</button>
      </div>`;
  }

  $("paginacao").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pagina]");
    if (!b || b.disabled) return;
    pagina = Number(b.dataset.pagina);
    renderTabela();
    // mantém o topo da tabela visível ao trocar de página
    const sec = $("tabela").closest("section");
    if (sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ behavior: "smooth" });
  });

  window.addEventListener("beforeprint", () => { imprimindo = true; renderTabela(); });
  window.addEventListener("afterprint", () => { imprimindo = false; renderTabela(); });

  $("tabela").addEventListener("click", (e) => {
    const linha = e.target.closest("tr.linha");
    if (!linha) return;
    const det = linha.nextElementSibling;
    det.hidden = !det.hidden;
    linha.classList.toggle("aberta", !det.hidden);
  });

  // ============================================================
  //  Banco de dados (Supabase) — endereço e chave no config.js
  // ============================================================
  const CFG = window.SUPABASE_CONFIG || {};
  let sb = null;          // cliente Supabase
  let usuario = null;     // usuário logado
  let ehEditor = false;   // e-mail está na tabela "editores"?
  const TABELA = "casos_teste";

  // linha do banco -> formato usado na tela (data dd/mm/aaaa)
  const doBanco = (r) => ({
    id: r.id,
    titulo: r.titulo,
    area: r.area,
    modulo: r.modulo,
    status: r.status,
    data: paraBR(r.data),
    realizador: r.realizador,
    observacoes: r.observacoes,
  });
  // formato da tela -> linha do banco
  const paraBanco = (t) => ({
    titulo: txt(t.titulo),
    area: txt(t.area),
    modulo: txt(t.modulo),
    status: statusDe(t),
    data: paraISO(t.data) || null,
    realizador: statusDe(t) === "pendente" ? "" : txt(t.realizador),
    observacoes: txt(t.observacoes) || "Sem observações.",
  });

  const erroBanco = (error) => {
    if (!error) return;
    const msg = String(error.message || error);
    if (/row-level security|permission denied/i.test(msg))
      throw new Error("seu usuário não tem permissão para editar (peça para incluir seu e-mail na tabela de editores).");
    throw new Error(msg);
  };

  async function carregarDoBanco() {
    const { data, error } = await sb.from(TABELA).select("*").order("id", { ascending: true });
    erroBanco(error);
    testes = (data || []).map(doBanco);
  }

  async function exigirEditor() {
    if (!usuario) {
      abrirLogin();
      throw new Error("faça login para salvar.");
    }
    if (!ehEditor) throw new Error("seu usuário não tem permissão para editar (peça para incluir seu e-mail na tabela de editores).");
  }

  // Cada operação devolve "gravado" e recarrega a lista do banco
  const armazenamento = {
    async adicionar(dados) {
      await exigirEditor();
      const { error } = await sb.from(TABELA).insert(paraBanco(dados));
      erroBanco(error);
      await carregarDoBanco();
      return "gravado";
    },
    async atualizar(original, dados) {
      await exigirEditor();
      const { data, error } = await sb.from(TABELA).update(paraBanco(dados)).eq("id", original.id).select("id");
      erroBanco(error);
      if (!data || !data.length) throw new Error("esse caso não existe mais no banco (pode ter sido excluído). Recarregue a página.");
      await carregarDoBanco();
      return "gravado";
    },
    async excluir(original) {
      await exigirEditor();
      const { error } = await sb.from(TABELA).delete().eq("id", original.id);
      erroBanco(error);
      await carregarDoBanco();
      return "gravado";
    },
  };

  // ---------- Login ----------
  const dlgLogin = $("modalLogin");
  const formLogin = $("formLogin");

  function abrirLogin() {
    formLogin.reset();
    $("erroLogin").hidden = true;
    dlgLogin.showModal();
    formLogin.elements.email.focus();
  }

  async function atualizarSessao(sessao) {
    usuario = sessao ? sessao.user : null;
    ehEditor = false;
    if (usuario) {
      const { data } = await sb.rpc("eh_editor");
      ehEditor = data === true;
    }
    renderAcesso();
  }

  // Mostra/esconde botões de edição conforme o login
  function renderAcesso() {
    document.body.classList.toggle("somente-leitura", !(usuario && ehEditor));
    $("btnEntrar").hidden = !sb || !!usuario;
    $("usuarioLogado").hidden = !usuario;
    if (usuario) {
      $("txtUsuario").textContent = usuario.email + (ehEditor ? "" : " (sem permissão de edição)");
    }
  }

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = txt(formLogin.elements.email.value);
    const senha = formLogin.elements.senha.value;
    $("erroLogin").hidden = true;
    formLogin.classList.add("gravando");
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    formLogin.classList.remove("gravando");
    if (error) {
      $("erroLogin").textContent = /invalid/i.test(error.message) ? "E-mail ou senha incorretos." : error.message;
      $("erroLogin").hidden = false;
      return;
    }
    dlgLogin.close();
    toast("Login feito.");
  });

  $("btnEntrar").addEventListener("click", abrirLogin);
  $("btnSair").addEventListener("click", async () => {
    await sb.auth.signOut();
    toast("Você saiu.");
  });
  $("btnFecharLogin").addEventListener("click", () => dlgLogin.close());
  dlgLogin.addEventListener("click", (e) => { if (e.target === dlgLogin) dlgLogin.close(); });

  // ============================================================
  //  Modal: novo / editar caso de teste
  // ============================================================
  const dlg = $("modal");
  const form = $("formTeste");
  const C = form.elements;
  let editando = null; // cópia do teste original quando está editando

  function preencherListas() {
    const lista = todos();
    const opts = (vals) => vals.map((v) => `<option value="${esc(v)}">`).join("");
    $("lstAreas").innerHTML = opts(unicos(lista.map((t) => txt(t.area))));
    $("lstModulos").innerHTML = opts(unicos(lista.map((t) => txt(t.modulo))));
    $("lstRealizadores").innerHTML = opts(unicos(lista.map((t) => txt(t.realizador))));
  }

  function atualizarRealizador() {
    const pend = C.status.value === "pendente";
    C.realizador.disabled = pend;
    if (pend) C.realizador.value = "";
    $("dicaRealizador").hidden = !pend;
  }

  function mostrarErro(msg) {
    $("erroForm").textContent = msg;
    $("erroForm").hidden = !msg;
  }

  function abrirModal(teste = null) {
    if (!usuario) return abrirLogin();
    form.reset();
    mostrarErro("");
    editando = teste ? { ...teste } : null;
    $("modalTitulo").textContent = teste ? "Editar caso de teste" : "Novo caso de teste";
    $("btnConfirmar").textContent = teste ? "Salvar alterações" : "Adicionar";
    $("btnContinuar").hidden = !!teste;
    $("btnExcluir").hidden = !teste;
    if (teste) {
      C.titulo.value = txt(teste.titulo);
      C.area.value = txt(teste.area);
      C.modulo.value = txt(teste.modulo);
      C.status.value = statusDe(teste);
      C.data.value = paraISO(teste.data);
      C.realizador.value = txt(teste.realizador);
      C.observacoes.value = temObs(teste) ? txt(teste.observacoes) : "";
    } else {
      C.data.value = hojeISO();
    }
    atualizarRealizador();
    preencherListas();
    dlg.showModal();
    C.titulo.focus();
  }

  form.addEventListener("change", (e) => {
    if (e.target.name === "status") atualizarRealizador();
  });

  // Executa uma gravação com o modal travado e trata erros
  let gravando = false;
  async function executar(operacao) {
    if (gravando) return null;
    gravando = true;
    form.classList.add("gravando");
    mostrarErro("");
    try {
      return await operacao();
    } catch (err) {
      mostrarErro(`Não foi possível gravar: ${err.message}`);
      return null;
    } finally {
      gravando = false;
      form.classList.remove("gravando");
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (gravando) return;
    const faltando = ["titulo", "area", "modulo"].filter((c) => !txt(C[c].value));
    if (!C.status.value) faltando.push("status");
    if (faltando.length) {
      const nomes = { titulo: "Funcionalidade", area: "Área", modulo: "Módulo", status: "Status" };
      mostrarErro(`Preencha: ${faltando.map((c) => nomes[c]).join(", ")}.`);
      return;
    }
    const status = C.status.value;
    const dados = {
      titulo: txt(C.titulo.value),
      area: txt(C.area.value),
      modulo: txt(C.modulo.value),
      status,
      data: paraBR(C.data.value),
      realizador: status === "pendente" ? "" : txt(C.realizador.value),
      observacoes: txt(C.observacoes.value) || "Sem observações.",
    };
    const continuar = e.submitter && e.submitter.value === "continuar";
    const original = editando;

    const resultado = await executar(() =>
      original ? armazenamento.atualizar(original, dados) : armazenamento.adicionar(dados)
    );
    if (!resultado) return;

    renderTudo();
    toast(`“${dados.titulo}” ${original ? "atualizado" : "adicionado"}.`);

    if (continuar) {
      // mantém área, módulo, status, data e realizador para agilizar o próximo
      C.titulo.value = "";
      C.observacoes.value = "";
      preencherListas();
      C.titulo.focus();
    } else {
      dlg.close();
    }
  });

  $("btnExcluir").addEventListener("click", async () => {
    const original = editando;
    if (!original || gravando) return;
    if (!confirm(`Excluir o caso de teste “${txt(original.titulo)}”?`)) return;
    const resultado = await executar(() => armazenamento.excluir(original));
    if (!resultado) return;
    renderTudo();
    dlg.close();
    toast(`“${txt(original.titulo)}” excluído.`);
  });

  // Botão ✎ de cada linha da tabela
  $("tabela").addEventListener("click", (e) => {
    const b = e.target.closest("[data-editar]");
    if (!b) return;
    e.stopPropagation();
    abrirModal(testes[Number(b.dataset.editar)]);
  }, true);

  $("btnNovo").addEventListener("click", () => abrirModal());
  $("btnCancelar").addEventListener("click", () => dlg.close());
  $("btnFechar").addEventListener("click", () => dlg.close());
  // clicar fora do modal fecha
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // ============================================================
  //  Render geral e inicialização
  // ============================================================
  function renderTudo() {
    renderPeriodo();
    renderResumo(todos());
    renderFiltros();
    renderAcesso();
  }

  async function iniciar() {
    renderTudo();
    $("contagem").textContent = "Carregando…";
    try {
      if (!txt(CFG.url) || !txt(CFG.anonKey)) throw new Error("preencha a url e a chave do Supabase no config.js.");
      if (!window.supabase) throw new Error("biblioteca do Supabase não carregou (verifique a internet).");
      sb = window.supabase.createClient(CFG.url, CFG.anonKey);
      const { data } = await sb.auth.getSession();
      await atualizarSessao(data.session);
      sb.auth.onAuthStateChange((_evento, sessao) => {
        // evita chamar o Supabase dentro do próprio callback
        setTimeout(() => atualizarSessao(sessao).then(renderTudo), 0);
      });
      await carregarDoBanco();
      renderTudo();
    } catch (err) {
      $("contagem").textContent = "";
      $("vazio").hidden = false;
      $("vazio").textContent = `Não foi possível carregar os casos de teste: ${err.message}`;
    }
  }
  iniciar();

  // ============================================================
  //  Tema
  // ============================================================
  const temaSalvo = lerLS("tema");
  if (temaSalvo) document.documentElement.dataset.theme = temaSalvo;
  const chk = $("chkTema");
  chk.checked = document.documentElement.dataset.theme === "dark";
  chk.addEventListener("change", () => {
    const novo = chk.checked ? "dark" : "light";
    document.documentElement.dataset.theme = novo;
    gravarLS("tema", novo);
  });
})();
