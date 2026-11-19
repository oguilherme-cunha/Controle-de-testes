(function () {
  const $ = (id) => document.getElementById(id);

  // ============================================================
  //  Utilitários
  // ============================================================
  const STATUS = {
    aprovado:  { label: "Aprovado",  cor: "var(--aprovado)" },
    reprovado: { label: "Reprovado", cor: "var(--reprovado)" },
    pendente:  { label: "Pendente",  cor: "var(--pendente)" },
  };
  // Status do tester (calculado pelos casos atribuídos)
  const STATUS_TESTER = {
    nao:       { label: "Não iniciou",  um: "não iniciou",  varios: "não iniciaram", cor: "var(--nao-iniciou)" },
    andamento: { label: "Em andamento", um: "em andamento", varios: "em andamento",  cor: "var(--pendente)" },
    concluido: { label: "Concluído",    um: "concluiu",     varios: "concluíram",    cor: "var(--aprovado)" },
    sem:       { label: "Sem casos",    um: "sem casos",    varios: "sem casos",     cor: "var(--muted)", contorno: true },
  };

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const txt = (v) => String(v ?? "").trim();
  const chave = (v) => txt(v).toLowerCase();

  // Considera vazio também textos como "Sem observações" / "sem observacao."
  const temObs = (o) => {
    const s = txt(o).toLowerCase().replace(/[.\s]+$/, "");
    return s !== "" && !/^sem observa(ç|c)(ões|oes|ão|ao)$/.test(s);
  };

  const ordenar = (arr) => arr.sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
  const unicos = (arr) => ordenar([...new Set(arr.filter(Boolean))]);
  const pct = (n, d) => (d ? (n / d) * 100 : 0);

  const lerLS = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarLS = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const paraISO = (br) => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(txt(br));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const paraBR = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(iso));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
  };
  const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // "Maria Vitoria Barreto Queiroz" -> "Maria Queiroz"
  const nomeCurto = (n) => {
    const p = txt(n).split(/\s+/);
    return p.length > 1 ? `${p[0]} ${p.at(-1)}` : p[0] || "";
  };

  const badge = (s) =>
    `<span class="badge${s.contorno ? " badge-contorno" : ""}" style="--c:${s.cor}">${s.label}</span>`;

  let toastTimer;
  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 5000);
  }

  // ============================================================
  //  Dados (carregados do Supabase e ligados entre si)
  // ============================================================
  let testers = [];   // { id, nome, usuario, area, execs[], status, feitos, ... }
  let casos = [];     // { id, titulo, modulo, execs[], status, dataISO, temObs }
  let execucoes = []; // { id, caso, tester, status, data, observacoes }

  const areaDe = (t) => txt(t.area) || "Sem área";
  const moduloDe = (c) => txt(c.modulo) || "Sem módulo";

  // Caso: reprovado se alguém reprovou; aprovado se todos aprovaram; senão pendente
  function statusCaso(c) {
    if (!c.execs.length) return "pendente";
    if (c.execs.some((e) => e.status === "reprovado")) return "reprovado";
    if (c.execs.every((e) => e.status === "aprovado")) return "aprovado";
    return "pendente";
  }

  // Tester: sem casos / não iniciou / em andamento / concluído
  function statusTester(t) {
    if (!t.execs.length) return "sem";
    if (!t.feitos) return "nao";
    return t.feitos < t.execs.length ? "andamento" : "concluido";
  }

  function montar(linhasT, linhasC, linhasE) {
    testers = linhasT.map((r) => ({ id: r.id, nome: txt(r.nome), usuario: txt(r.usuario), area: txt(r.area), execs: [] }));
    casos = linhasC.map((r) => ({ id: r.id, titulo: txt(r.titulo), modulo: txt(r.modulo), execs: [] }));
    const mapaT = new Map(testers.map((t) => [t.id, t]));
    const mapaC = new Map(casos.map((c) => [c.id, c]));

    execucoes = linhasE
      .filter((r) => mapaC.has(r.caso_id) && mapaT.has(r.tester_id))
      .map((r) => ({
        id: r.id,
        caso: mapaC.get(r.caso_id),
        tester: mapaT.get(r.tester_id),
        status: STATUS[r.status] ? r.status : "pendente",
        data: paraBR(r.data),
        observacoes: txt(r.observacoes),
      }));
    execucoes.forEach((e) => {
      e.caso.execs.push(e);
      e.tester.execs.push(e);
    });

    casos.forEach((c) => {
      c.execs.sort((a, b) => a.tester.nome.localeCompare(b.tester.nome, "pt-BR"));
      c.status = statusCaso(c);
      c.dataISO = c.execs.map((e) => paraISO(e.data)).filter(Boolean).sort().at(-1) || "";
      c.temObs = c.execs.some((e) => temObs(e.observacoes));
    });
    testers.forEach((t) => {
      const cont = { aprovado: 0, reprovado: 0, pendente: 0 };
      t.execs.forEach((e) => cont[e.status]++);
      t.cont = cont;
      t.feitos = cont.aprovado + cont.reprovado;
      t.status = statusTester(t);
    });
    testers.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    casos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR") || a.modulo.localeCompare(b.modulo, "pt-BR"));
  }

  const casoPorId = (id) => casos.find((c) => c.id === Number(id));
  const testerPorId = (id) => testers.find((t) => t.id === Number(id));
  const execPorId = (id) => execucoes.find((e) => e.id === Number(id));

  // ============================================================
  //  Informações gerais: o período vem das datas dos testes
  // ============================================================
  function renderPeriodo() {
    const datas = execucoes.map((e) => paraISO(e.data)).filter(Boolean).sort();
    $("periodo").textContent = !datas.length
      ? "—"
      : datas[0] === datas.at(-1)
        ? paraBR(datas[0])
        : `${paraBR(datas[0])} a ${paraBR(datas.at(-1))}`;
  }

  // ============================================================
  //  Resumo da execução
  // ============================================================
  function renderResumo() {
    const total = casos.length;
    const cont = { aprovado: 0, reprovado: 0, pendente: 0 };
    casos.forEach((c) => cont[c.status]++);

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
      `<div class="kpi"><strong>${total}</strong><span>Casos</span></div>` +
      Object.entries(STATUS)
        .map(([k, s]) => `<div class="kpi" style="--c:${s.cor}"><strong>${cont[k]}</strong><span>${s.label}</span></div>`)
        .join("");

    // Testers por status (clicar leva à aba Testers filtrada)
    const ct = {};
    testers.forEach((t) => (ct[t.status] = (ct[t.status] || 0) + 1));
    $("resumoTesters").innerHTML = testers.length
      ? `<strong>${testers.length} testers:</strong> ` +
        Object.entries(STATUS_TESTER)
          .filter(([k]) => ct[k])
          .map(([k, s]) => `<button type="button" class="link-status" data-status-tester="${k}">
              <i class="ponto" style="background:${s.cor}"></i>${ct[k]} ${ct[k] > 1 ? s.varios : s.um}</button>`)
          .join("")
      : "";

    // Por área: testes feitos pelas pessoas de cada área; casos sem tester = "Sem área"
    const porArea = {};
    const somar = (area, status) => {
      porArea[area] ??= { total: 0, aprovado: 0, reprovado: 0, pendente: 0 };
      porArea[area].total++;
      porArea[area][status]++;
    };
    execucoes.forEach((e) => somar(areaDe(e.tester), e.status));
    casos.filter((c) => !c.execs.length).forEach(() => somar("Sem área", "pendente"));

    const areas = ordenar(Object.keys(porArea).filter((a) => a !== "Sem área"));
    if (porArea["Sem área"]) areas.push("Sem área");
    $("areas").innerHTML = areas
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

  $("areas").addEventListener("click", (e) => {
    const b = e.target.closest(".link-area");
    if (!b) return;
    mostrarAba("casos", true);
    filtrosCasos.somente("area", b.dataset.area);
  });
  $("resumoTesters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-status-tester]");
    if (!b) return;
    mostrarAba("testers", true);
    filtrosTesters.somente("status", b.dataset.statusTester);
  });

  // ============================================================
  //  Abas
  // ============================================================
  let abaAtual = "casos";
  function mostrarAba(nome, rolar = false) {
    abaAtual = nome;
    document.querySelectorAll(".aba").forEach((b) => {
      const ativa = b.dataset.aba === nome;
      b.setAttribute("aria-selected", ativa);
      b.tabIndex = ativa ? 0 : -1;
    });
    $("painelCasos").hidden = nome !== "casos";
    $("painelTesters").hidden = nome !== "testers";
    // guarda a aba no endereço (…/#testers) para dar F5 ou mandar o link
    try {
      history.replaceState(null, "", location.pathname + location.search + (nome === "testers" ? "#testers" : ""));
    } catch {}
    if (rolar) $("abaCasos").closest("section").scrollIntoView({ behavior: "smooth" });
  }
  document.querySelector(".abas").addEventListener("click", (e) => {
    const b = e.target.closest(".aba");
    if (b) mostrarAba(b.dataset.aba);
  });
  document.querySelector(".abas").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const prox = abaAtual === "casos" ? "testers" : "casos";
    mostrarAba(prox);
    document.querySelector(`.aba[data-aba="${prox}"]`).focus();
  });

  // ============================================================
  //  Filtros (multisseleção: OU dentro do mesmo filtro, E entre filtros)
  //  Usado nas duas abas. Cada filtro devolve uma LISTA de valores
  //  por item (um caso pode ter vários testers / áreas).
  // ============================================================
  const abertos = new Set(); // filtros com popover aberto (no máximo 1)

  function criarFiltros({ grupo, chips, busca, defs, itens, texto, aoMudar }) {
    const F = Object.fromEntries(defs.map((d) => [d.campo, d]));
    const sel = Object.fromEntries(defs.map((d) => [d.campo, new Set()]));
    const nomeDe = (d, v) => (d.nome ? d.nome(v) : v);
    let aberto = null;

    function passa(item, exceto) {
      const termo = chave(busca.value);
      if (termo && !texto(item).toLowerCase().includes(termo)) return false;
      return defs.every(
        (d) => d.campo === exceto || !sel[d.campo].size || d.valores(item).some((v) => sel[d.campo].has(v))
      );
    }

    grupo.innerHTML = defs
      .map(
        (d) => `
        <div class="filtro" data-campo="${d.campo}">
          <button type="button" class="filtro-btn" aria-expanded="false" aria-haspopup="true">
            ${esc(d.label)} <span class="filtro-cont" hidden></span><span class="seta">▾</span>
          </button>
          <div class="pop" hidden>
            <input type="search" class="pop-busca" placeholder="Filtrar ${esc(d.label.toLowerCase())}…" />
            <div class="pop-opcoes"></div>
            <div class="pop-rodape">
              <button type="button" class="pop-limpar">Limpar</button>
              <button type="button" class="pop-ok">OK</button>
            </div>
          </div>
        </div>`
      )
      .join("");

    const el = (campo) => grupo.querySelector(`.filtro[data-campo="${campo}"]`);

    function abrir(campo) {
      abertos.forEach((f) => f !== api && f.fechar());
      if (aberto && aberto !== campo) fechar();
      const e = el(campo);
      e.querySelector(".pop").hidden = false;
      e.querySelector(".filtro-btn").setAttribute("aria-expanded", "true");
      e.querySelector(".pop-busca").value = "";
      aberto = campo;
      abertos.add(api);
      renderOpcoes(campo);
      e.querySelector(".pop-busca").focus();
    }
    function fechar() {
      if (!aberto) return;
      const e = el(aberto);
      e.querySelector(".pop").hidden = true;
      e.querySelector(".filtro-btn").setAttribute("aria-expanded", "false");
      aberto = null;
      abertos.delete(api);
    }

    function renderOpcoes(campo) {
      const d = F[campo];
      const e = el(campo);
      const b = chave(e.querySelector(".pop-busca").value);
      const lista = itens();
      const cont = {};
      lista.filter((i) => passa(i, campo)).forEach((i) => {
        new Set(d.valores(i)).forEach((v) => (cont[v] = (cont[v] || 0) + 1));
      });
      let valores = d.ordem || unicos(lista.flatMap(d.valores));
      // "Sem ..." sempre no fim da lista
      valores = [...valores.filter((v) => !/^Sem /.test(v)), ...valores.filter((v) => /^Sem /.test(v))];
      valores = valores.filter((v) => !b || nomeDe(d, v).toLowerCase().includes(b));

      e.querySelector(".pop-opcoes").innerHTML = valores.length
        ? valores
            .map(
              (v) => `
            <label class="pop-op${cont[v] ? "" : " zerado"}">
              <input type="checkbox" value="${esc(v)}" ${sel[campo].has(v) ? "checked" : ""} />
              ${d.cor ? `<i class="ponto" style="background:${d.cor(v)}"></i>` : ""}
              <span class="pop-nome">${esc(nomeDe(d, v))}</span>
              <span class="pop-num">${cont[v] || 0}</span>
            </label>`
            )
            .join("")
        : `<p class="pop-vazio">Nada encontrado.</p>`;
    }

    function render() {
      defs.forEach((d) => {
        const n = sel[d.campo].size;
        const e = el(d.campo);
        const badgeEl = e.querySelector(".filtro-cont");
        badgeEl.hidden = !n;
        badgeEl.textContent = n;
        e.classList.toggle("ativo", n > 0);
      });
      const lista = defs.flatMap((d) =>
        [...sel[d.campo]].map(
          (v) => `<button type="button" class="chip" data-campo="${d.campo}" data-valor="${esc(v)}" title="Remover filtro">
            <span class="chip-rot">${esc(d.label)}:</span> ${esc(nomeDe(d, v))} <span aria-hidden="true">✕</span></button>`
        )
      );
      const temFiltro = lista.length || txt(busca.value);
      chips.innerHTML = lista.join("") + (temFiltro ? `<button type="button" class="chip-limpar">Limpar filtros</button>` : "");
      if (aberto) renderOpcoes(aberto);
    }

    function mudou() {
      render();
      aoMudar();
    }

    grupo.addEventListener("click", (e) => {
      const f = e.target.closest(".filtro");
      if (!f) return;
      const campo = f.dataset.campo;
      if (e.target.closest(".filtro-btn")) aberto === campo ? fechar() : abrir(campo);
      else if (e.target.closest(".pop-limpar")) { sel[campo].clear(); mudou(); }
      else if (e.target.closest(".pop-ok")) fechar();
    });
    grupo.addEventListener("change", (e) => {
      if (e.target.type !== "checkbox") return;
      const campo = e.target.closest(".filtro").dataset.campo;
      e.target.checked ? sel[campo].add(e.target.value) : sel[campo].delete(e.target.value);
      mudou();
    });
    grupo.addEventListener("input", (e) => {
      if (e.target.classList.contains("pop-busca")) renderOpcoes(e.target.closest(".filtro").dataset.campo);
    });
    chips.addEventListener("click", (e) => {
      const c = e.target.closest("[data-campo]");
      if (c) sel[c.dataset.campo].delete(c.dataset.valor);
      else if (e.target.closest(".chip-limpar")) {
        Object.values(sel).forEach((s) => s.clear());
        busca.value = "";
      } else return;
      mudou();
    });
    busca.addEventListener("input", mudou);
    document.addEventListener("click", (e) => {
      if (aberto && !el(aberto).contains(e.target)) fechar();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && aberto) {
        const btn = el(aberto).querySelector(".filtro-btn");
        fechar();
        btn.focus();
      }
    });

    const api = {
      passa,
      render,
      fechar,
      // limpa tudo e aplica um único filtro (usado pelos links do resumo)
      somente(campo, valor) {
        Object.values(sel).forEach((s) => s.clear());
        busca.value = "";
        sel[campo].add(valor);
        mudou();
      },
    };
    return api;
  }

  // ============================================================
  //  Aba: Casos de teste
  // ============================================================
  const POR_PAGINA = 10;
  let pagina = 1;
  let imprimindo = false;      // na impressão, mostra todos os casos filtrados
  const casosAbertos = new Set(); // ids com o detalhe aberto

  const filtrosCasos = criarFiltros({
    grupo: $("filtrosCasos"),
    chips: $("chipsCasos"),
    busca: $("buscaCasos"),
    itens: () => casos,
    texto: (c) => `${c.titulo} ${c.modulo} ${c.execs.map((e) => `${e.tester.nome} ${e.observacoes}`).join(" ")}`,
    aoMudar: () => { pagina = 1; renderCasos(); },
    defs: [
      { campo: "modulo", label: "Módulo", valores: (c) => [moduloDe(c)] },
      {
        campo: "status", label: "Status", valores: (c) => [c.status],
        nome: (v) => STATUS[v].label, ordem: Object.keys(STATUS), cor: (v) => STATUS[v].cor,
      },
      {
        campo: "tester", label: "Tester",
        valores: (c) => (c.execs.length ? c.execs.map((e) => e.tester.nome) : ["Sem tester"]),
      },
      {
        campo: "area", label: "Área",
        valores: (c) => (c.execs.length ? [...new Set(c.execs.map((e) => areaDe(e.tester)))] : ["Sem área"]),
      },
      {
        campo: "obs", label: "Observação", valores: (c) => [c.temObs ? "com" : "sem"],
        nome: (v) => (v === "com" ? "Com observação" : "Sem observação"), ordem: ["com", "sem"],
      },
    ],
  });

  function testersDoCaso(c) {
    if (!c.execs.length) return `<span class="apagado">Sem tester</span>`;
    const nomes = c.execs.map((e) => nomeCurto(e.tester.nome));
    const mais = nomes.length > 2 ? ` <span class="mais">+${nomes.length - 2}</span>` : "";
    return `<span title="${esc(c.execs.map((e) => e.tester.nome).join(", "))}">${esc(nomes.slice(0, 2).join(", "))}${mais}</span>`;
  }

  function resumoStatus(c) {
    // só mostra o detalhe quando há mais de um tester
    const n = c.execs.length;
    if (n < 2) return "";
    const ap = c.execs.filter((e) => e.status === "aprovado").length;
    return `<small class="sub-status">${ap} de ${n} aprovaram</small>`;
  }

  function detalheCaso(c) {
    const linhas = c.execs
      .map(
        (e) => `
        <div class="exec">
          <div class="exec-quem">
            <strong>${esc(e.tester.nome)}</strong>
            <small>${esc(areaDe(e.tester))}</small>
          </div>
          <div class="exec-status">${badge(STATUS[e.status])}<small>${esc(e.data) || "sem data"}</small></div>
          <p class="exec-obs${temObs(e.observacoes) ? "" : " apagado"}">${temObs(e.observacoes) ? esc(e.observacoes) : "Sem observações."}</p>
          <button type="button" class="btn-editar so-editor" data-editar-exec="${e.id}" title="Editar resultado" aria-label="Editar resultado de ${esc(e.tester.nome)}">✎</button>
        </div>`
      )
      .join("");
    return `
      <div class="execs">
        ${linhas || `<p class="apagado">Nenhum tester atribuído a este caso.</p>`}
        <button type="button" class="btn-sec btn-mini so-editor" data-add-exec="${c.id}">+ Adicionar tester</button>
      </div>`;
  }

  function renderCasos() {
    const lista = casos.filter((c) => filtrosCasos.passa(c));
    $("numCasos").textContent = casos.length;
    $("contagemCasos").textContent =
      lista.length === casos.length ? `${casos.length} casos` : `${lista.length} de ${casos.length} casos (filtrados)`;
    $("vazioCasos").hidden = lista.length > 0;

    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
    pagina = Math.min(Math.max(1, pagina), paginas);
    const ini = (pagina - 1) * POR_PAGINA;
    const visiveis = imprimindo ? lista : lista.slice(ini, ini + POR_PAGINA);
    renderPaginacao(lista.length, paginas, ini);

    $("tabelaCasos").innerHTML = visiveis
      .map((c) => {
        const aberto = casosAbertos.has(c.id);
        return `
          <tr class="linha${aberto ? " aberta" : ""}" data-caso="${c.id}">
            <td>
              ${esc(c.titulo)}
              ${c.temObs ? `<span class="tag-obs" title="Tem observação" aria-label="Tem observação">💬</span>` : ""}
            </td>
            <td>${esc(c.modulo)}</td>
            <td>${testersDoCaso(c)}</td>
            <td>${badge(STATUS[c.status])}${resumoStatus(c)}</td>
            <td>${paraBR(c.dataISO) || "—"}</td>
            <td class="col-acoes"><button type="button" class="btn-editar" data-editar-caso="${c.id}" title="Editar caso" aria-label="Editar caso">✎</button></td>
          </tr>
          <tr class="detalhe" ${aberto ? "" : "hidden"}><td colspan="6">${detalheCaso(c)}</td></tr>`;
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
    const btn = (n) =>
      `<button type="button" class="pag-btn${n === pagina ? " atual" : ""}" data-pagina="${n}"${n === pagina ? ' aria-current="page"' : ""}>${n}</button>`;
    el.innerHTML = `
      <span class="pag-info">${ini + 1}–${fim} de ${qtd}</span>
      <div class="pag-botoes">
        <button type="button" class="pag-btn" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""} aria-label="Página anterior">‹ Anterior</button>
        ${numerosPagina(pagina, paginas).map((n) => (n === "…" ? `<span class="pag-reticencias">…</span>` : btn(n))).join("")}
        <button type="button" class="pag-btn" data-pagina="${pagina + 1}" ${pagina === paginas ? "disabled" : ""} aria-label="Próxima página">Próxima ›</button>
      </div>`;
  }

  $("paginacao").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pagina]");
    if (!b || b.disabled) return;
    pagina = Number(b.dataset.pagina);
    renderCasos();
    const sec = $("tabelaCasos").closest("section");
    if (sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ behavior: "smooth" });
  });

  window.addEventListener("beforeprint", () => { imprimindo = true; renderCasos(); });
  window.addEventListener("afterprint", () => { imprimindo = false; renderCasos(); });

  $("tabelaCasos").addEventListener("click", (e) => {
    const editarCaso = e.target.closest("[data-editar-caso]");
    const editarExec = e.target.closest("[data-editar-exec]");
    const addExec = e.target.closest("[data-add-exec]");
    if (editarCaso) return abrirModalCaso(casoPorId(editarCaso.dataset.editarCaso));
    if (editarExec) return abrirModalExec({ exec: execPorId(editarExec.dataset.editarExec) });
    if (addExec) return abrirModalExec({ caso: casoPorId(addExec.dataset.addExec) });

    const linha = e.target.closest("tr.linha");
    if (!linha) return;
    const id = Number(linha.dataset.caso);
    const det = linha.nextElementSibling;
    det.hidden = !det.hidden;
    linha.classList.toggle("aberta", !det.hidden);
    det.hidden ? casosAbertos.delete(id) : casosAbertos.add(id);
  });

  // Mostra um caso específico na tabela (usado ao achar um caso repetido)
  function revelarCaso(c) {
    mostrarAba("casos", true);
    filtrosCasos.somente("modulo", moduloDe(c));
    $("buscaCasos").value = c.titulo;
    casosAbertos.add(c.id);
    pagina = 1;
    filtrosCasos.render();
    renderCasos();
  }

  // ============================================================
  //  Aba: Testers
  // ============================================================
  const filtrosTesters = criarFiltros({
    grupo: $("filtrosTesters"),
    chips: $("chipsTesters"),
    busca: $("buscaTesters"),
    itens: () => testers,
    texto: (t) => `${t.nome} ${t.usuario} ${t.area}`,
    aoMudar: () => renderTesters(),
    defs: [
      {
        campo: "status", label: "Status", valores: (t) => [t.status],
        nome: (v) => STATUS_TESTER[v].label, ordem: Object.keys(STATUS_TESTER), cor: (v) => STATUS_TESTER[v].cor,
      },
      { campo: "area", label: "Área", valores: (t) => [areaDe(t)] },
    ],
  });

  function renderTesters() {
    const lista = testers.filter((t) => filtrosTesters.passa(t));
    $("numTesters").textContent = testers.length;
    $("contagemTesters").textContent =
      lista.length === testers.length ? `${testers.length} testers` : `${lista.length} de ${testers.length} testers (filtrados)`;
    $("vazioTesters").hidden = lista.length > 0;

    $("tabelaTesters").innerHTML = lista
      .map((t) => {
        const n = t.execs.length;
        const seg = (k) =>
          t.cont[k] ? `<span style="width:${pct(t.cont[k], n)}%;background:${STATUS[k].cor}" title="${STATUS[k].label}: ${t.cont[k]}"></span>` : "";
        return `
          <tr>
            <td>
              ${n
                ? `<button type="button" class="link-area" data-ver-tester="${t.id}" title="Ver os casos dessa pessoa">${esc(t.nome)}</button>`
                : esc(t.nome)}
            </td>
            <td>${esc(t.usuario) || "—"}</td>
            <td>${esc(areaDe(t))}</td>
            <td>${badge(STATUS_TESTER[t.status])}</td>
            <td class="col-barra">
              ${n
                ? `<div class="barra">${seg("aprovado")}${seg("reprovado")}${seg("pendente")}</div>
                   <small>${t.feitos} de ${n} testado${n > 1 ? "s" : ""}</small>`
                : `<small>—</small>`}
            </td>
            <td class="resultados">
              <span style="--c:var(--aprovado)" title="Aprovados">✓ ${t.cont.aprovado}</span>
              <span style="--c:var(--reprovado)" title="Reprovados">✕ ${t.cont.reprovado}</span>
            </td>
            <td class="col-acoes">
              <button type="button" class="btn-editar" data-atribuir="${t.id}" title="Atribuir casos" aria-label="Atribuir casos a ${esc(t.nome)}">＋</button>
              <button type="button" class="btn-editar" data-editar-tester="${t.id}" title="Editar tester" aria-label="Editar ${esc(t.nome)}">✎</button>
            </td>
          </tr>`;
      })
      .join("");
  }

  $("tabelaTesters").addEventListener("click", (e) => {
    const ver = e.target.closest("[data-ver-tester]");
    const atribuir = e.target.closest("[data-atribuir]");
    const editar = e.target.closest("[data-editar-tester]");
    if (ver) {
      mostrarAba("casos", true);
      filtrosCasos.somente("tester", testerPorId(ver.dataset.verTester).nome);
    } else if (atribuir) abrirModalAtribuir(testerPorId(atribuir.dataset.atribuir));
    else if (editar) abrirModalTester(testerPorId(editar.dataset.editarTester));
  });

  // ============================================================
  //  Banco de dados (Supabase) — endereço e chave no config.js
  // ============================================================
  const CFG = window.SUPABASE_CONFIG || {};
  let sb = null;          // cliente Supabase
  let usuario = null;     // usuário logado
  let ehEditor = false;   // e-mail está na tabela "editores"?

  const SEM_PERMISSAO = "seu usuário não tem permissão para editar (peça para incluir seu e-mail na tabela de editores).";

  // Traduz erros do banco. msgs: { duplicado, emUso } para erros de chave
  function checar({ data, error }, msgs = {}) {
    if (!error) return data;
    const msg = String(error.message || error);
    if (error.code === "23505") throw new Error(msgs.duplicado || "esse registro já existe.");
    if (error.code === "23503") throw new Error(msgs.emUso || "esse registro está em uso.");
    if (/row-level security|permission denied/i.test(msg)) throw new Error(SEM_PERMISSAO);
    throw new Error(msg);
  }

  async function carregar() {
    const [t, c, e] = await Promise.all([
      sb.from("testers").select("id,nome,usuario,area"),
      sb.from("casos").select("id,titulo,modulo").order("id", { ascending: true }),
      sb.from("execucoes").select("id,caso_id,tester_id,status,data,observacoes").order("id", { ascending: true }),
    ]);
    montar(checar(t) || [], checar(c) || [], checar(e) || []);
  }

  function exigirEditor() {
    if (!usuario) {
      abrirLogin();
      throw new Error("faça login para salvar.");
    }
    if (!ehEditor) throw new Error(SEM_PERMISSAO);
  }

  const obsOuPadrao = (v) => txt(v) || "Sem observações.";

  const banco = {
    async novoCaso(dados, exec) {
      const linha = checar(
        await sb.from("casos").insert({ titulo: dados.titulo, modulo: dados.modulo }).select("id").single(),
        { duplicado: "esse caso já existe nesse módulo." }
      );
      if (exec) await banco.salvarExec({ ...exec, caso_id: linha.id });
    },
    async editarCaso(id, dados) {
      const r = checar(await sb.from("casos").update(dados).eq("id", id).select("id"), {
        duplicado: "já existe outro caso com essa funcionalidade nesse módulo.",
      });
      if (!r.length) throw new Error("esse caso não existe mais. Recarregue a página.");
    },
    async excluirCaso(id) {
      checar(await sb.from("casos").delete().eq("id", id));
    },
    async salvarExec({ id, caso_id, tester_id, status, data, observacoes }) {
      const linha = { status, data: paraISO(data) || null, observacoes: obsOuPadrao(observacoes) };
      if (id) {
        const r = checar(await sb.from("execucoes").update(linha).eq("id", id).select("id"));
        if (!r.length) throw new Error("esse resultado não existe mais. Recarregue a página.");
      } else {
        checar(await sb.from("execucoes").insert({ ...linha, caso_id, tester_id }), {
          duplicado: "essa pessoa já está nesse caso.",
        });
      }
    },
    async removerExec(id) {
      checar(await sb.from("execucoes").delete().eq("id", id));
    },
    async atribuir(tester_id, casoIds) {
      const linhas = casoIds.map((caso_id) => ({ caso_id, tester_id, status: "pendente", observacoes: "Sem observações." }));
      checar(await sb.from("execucoes").insert(linhas), { duplicado: "algum desses casos já estava atribuído. Recarregue a página." });
    },
    async salvarTester(id, dados) {
      const msgs = { duplicado: "já existe um tester com esse nome." };
      if (id) {
        const r = checar(await sb.from("testers").update(dados).eq("id", id).select("id"), msgs);
        if (!r.length) throw new Error("esse tester não existe mais. Recarregue a página.");
      } else {
        checar(await sb.from("testers").insert(dados), msgs);
      }
    },
    async excluirTester(id) {
      // remove só as atribuições pendentes; se houver teste feito, o banco recusa
      checar(await sb.from("execucoes").delete().eq("tester_id", id).eq("status", "pendente"));
      checar(await sb.from("testers").delete().eq("id", id), {
        emUso: "essa pessoa tem testes realizados e não pode ser excluída.",
      });
    },
  };

  // Executa uma gravação com o formulário travado; recarrega e redesenha tudo
  let gravando = false;
  async function gravar(form, erroEl, operacao) {
    if (gravando) return false;
    gravando = true;
    form.classList.add("gravando");
    mostrarErro(erroEl, "");
    try {
      exigirEditor();
      await operacao();
      await carregar();
      renderTudo();
      return true;
    } catch (err) {
      mostrarErro(erroEl, `Não foi possível salvar: ${err.message}`);
      return false;
    } finally {
      gravando = false;
      form.classList.remove("gravando");
    }
  }

  function mostrarErro(el, msg) {
    const alvo = el.querySelector(".erro-txt") || el;
    alvo.textContent = msg;
    el.hidden = !msg;
  }

  // ============================================================
  //  Login
  // ============================================================
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
    if (usuario) $("txtUsuario").textContent = usuario.email + (ehEditor ? "" : " (sem permissão de edição)");
  }

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    $("erroLogin").hidden = true;
    formLogin.classList.add("gravando");
    const { error } = await sb.auth.signInWithPassword({
      email: txt(formLogin.elements.email.value),
      password: formLogin.elements.senha.value,
    });
    formLogin.classList.remove("gravando");
    if (error) {
      mostrarErro($("erroLogin"), /invalid/i.test(error.message) ? "E-mail ou senha incorretos." : error.message);
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

  // Todos os modais: botões [data-fechar] e clique fora fecham
  document.querySelectorAll("dialog.modal").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-fechar]")) d.close();
    });
  });

  // Opções de tester para os <select>
  const opcoesTester = (lista, vazio) =>
    (vazio ? `<option value="">${esc(vazio)}</option>` : "") +
    lista.map((t) => `<option value="${t.id}">${esc(t.nome)} — ${esc(areaDe(t))}</option>`).join("");

  function preencherListas() {
    const opts = (vals) => vals.map((v) => `<option value="${esc(v)}">`).join("");
    $("lstModulos").innerHTML = opts(unicos(casos.map((c) => c.modulo)));
    $("lstAreas").innerHTML = opts(unicos(testers.map((t) => t.area)));
  }

  // ============================================================
  //  Modal: novo / editar caso
  // ============================================================
  const dlgCaso = $("modalCaso");
  const formCaso = $("formCaso");
  const CC = formCaso.elements;
  let casoEditando = null;
  let casoExistente = null; // caso repetido encontrado ao cadastrar

  function abrirModalCaso(caso = null) {
    if (!usuario) return abrirLogin();
    formCaso.reset();
    mostrarErro($("erroCaso"), "");
    $("btnAbrirExistente").hidden = true;
    casoEditando = caso;
    $("tituloModalCaso").textContent = caso ? "Editar caso de teste" : "Novo caso de teste";
    $("btnConfirmarCaso").textContent = caso ? "Salvar alterações" : "Adicionar";
    $("btnContinuarCaso").hidden = !!caso;
    $("btnExcluirCaso").hidden = !caso;
    $("blocoPrimeiroTester").hidden = !!caso;
    if (caso) {
      CC.titulo.value = caso.titulo;
      CC.modulo.value = caso.modulo;
    } else {
      $("selTesterCaso").innerHTML = opcoesTester(testers, "— Sem tester por enquanto —");
      CC.data.value = hojeISO();
    }
    atualizarBlocoTester();
    preencherListas();
    dlgCaso.showModal();
    CC.titulo.focus();
  }

  // Resultado só faz sentido com um tester escolhido
  function atualizarBlocoTester() {
    $("statusCaso").disabled = !CC.tester.value;
    if (!CC.tester.value) formCaso.querySelectorAll('[name="status"]').forEach((r) => (r.checked = false));
  }
  CC.tester.addEventListener("change", atualizarBlocoTester);

  const acharCaso = (titulo, modulo, exceto) =>
    casos.find((c) => c.id !== exceto && chave(c.titulo) === chave(titulo) && chave(c.modulo) === chave(modulo));

  formCaso.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (gravando) return;
    $("btnAbrirExistente").hidden = true;
    const dados = { titulo: txt(CC.titulo.value), modulo: txt(CC.modulo.value) };
    const faltando = [];
    if (!dados.titulo) faltando.push("Funcionalidade");
    if (!dados.modulo) faltando.push("Módulo");
    const comTester = !casoEditando && CC.tester.value;
    if (comTester && !CC.status.value) faltando.push("Resultado");
    if (faltando.length) return mostrarErro($("erroCaso"), `Preencha: ${faltando.join(", ")}.`);

    // Evita repetir funcionalidade no mesmo módulo
    casoExistente = acharCaso(dados.titulo, dados.modulo, casoEditando?.id);
    if (casoExistente) {
      mostrarErro($("erroCaso"), `Já existe o caso “${casoExistente.titulo}” no módulo ${casoExistente.modulo}.`);
      $("btnAbrirExistente").textContent = comTester ? "Adicionar o tester nesse caso" : "Abrir caso existente";
      $("btnAbrirExistente").hidden = false;
      return;
    }

    const exec = comTester
      ? { tester_id: Number(CC.tester.value), status: CC.status.value, data: paraBR(CC.data.value), observacoes: CC.observacoes.value }
      : null;
    const continuar = e.submitter && e.submitter.value === "continuar";
    const editando = casoEditando;
    const ok = await gravar(formCaso, $("erroCaso"), () =>
      editando ? banco.editarCaso(editando.id, dados) : banco.novoCaso(dados, exec)
    );
    if (!ok) return;
    toast(`“${dados.titulo}” ${editando ? "atualizado" : "adicionado"}.`);

    if (continuar) {
      // mantém módulo, tester, resultado e data para agilizar o próximo
      CC.titulo.value = "";
      CC.observacoes.value = "";
      preencherListas();
      CC.titulo.focus();
    } else {
      dlgCaso.close();
    }
  });

  // Caso repetido: abre o existente (ou já leva o tester para ele)
  $("btnAbrirExistente").addEventListener("click", () => {
    const c = casoExistente;
    if (!c) return;
    const prefill = CC.tester.value
      ? { tester_id: Number(CC.tester.value), status: CC.status.value, data: CC.data.value, observacoes: CC.observacoes.value }
      : null;
    dlgCaso.close();
    revelarCaso(c);
    if (prefill) abrirModalExec({ caso: c, prefill });
  });

  $("btnExcluirCaso").addEventListener("click", async () => {
    const c = casoEditando;
    if (!c || gravando) return;
    const n = c.execs.length;
    const aviso = n ? `\n\nOs resultados de ${n} tester${n > 1 ? "s" : ""} nesse caso também serão apagados.` : "";
    if (!confirm(`Excluir o caso “${c.titulo}”?${aviso}`)) return;
    if (await gravar(formCaso, $("erroCaso"), () => banco.excluirCaso(c.id))) {
      casosAbertos.delete(c.id);
      dlgCaso.close();
      toast(`“${c.titulo}” excluído.`);
    }
  });

  $("btnNovoCaso").addEventListener("click", () => abrirModalCaso());

  // ============================================================
  //  Modal: resultado de um tester em um caso
  // ============================================================
  const dlgExec = $("modalExec");
  const formExec = $("formExec");
  const CE = formExec.elements;
  let execEditando = null;
  let execCaso = null;

  // { exec } para editar; { caso, prefill? } para adicionar tester
  function abrirModalExec({ exec = null, caso = null, prefill = null }) {
    if (!usuario) return abrirLogin();
    formExec.reset();
    mostrarErro($("erroExec"), "");
    execEditando = exec;
    execCaso = exec ? exec.caso : caso;
    $("tituloModalExec").textContent = exec ? "Editar resultado" : "Adicionar tester";
    $("execCaso").innerHTML = `<strong>${esc(execCaso.titulo)}</strong> · ${esc(execCaso.modulo)}`;
    $("btnRemoverExec").hidden = !exec;

    if (exec) {
      $("selTesterExec").innerHTML = opcoesTester([exec.tester]);
      CE.tester.disabled = true;
      CE.status.value = exec.status;
      CE.data.value = paraISO(exec.data);
      CE.observacoes.value = temObs(exec.observacoes) ? exec.observacoes : "";
    } else {
      const jaNoCaso = new Set(execCaso.execs.map((e) => e.tester.id));
      const livres = testers.filter((t) => !jaNoCaso.has(t.id));
      $("selTesterExec").innerHTML = livres.length
        ? opcoesTester(livres, "— Escolha o tester —")
        : `<option value="">Todos os testers já estão nesse caso</option>`;
      CE.tester.disabled = false;
      CE.data.value = hojeISO();
      if (prefill) {
        if (jaNoCaso.has(prefill.tester_id)) {
          mostrarErro($("erroExec"), "Essa pessoa já está nesse caso. Edite o resultado dela na lista do caso.");
        } else {
          CE.tester.value = prefill.tester_id;
          if (prefill.status) CE.status.value = prefill.status;
          if (prefill.data) CE.data.value = prefill.data;
          CE.observacoes.value = prefill.observacoes || "";
        }
      }
    }
    dlgExec.showModal();
    (exec ? formExec.querySelector('[name="status"]:checked') || CE.data : CE.tester).focus();
  }

  formExec.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (gravando) return;
    const faltando = [];
    if (!execEditando && !CE.tester.value) faltando.push("Tester");
    if (!CE.status.value) faltando.push("Resultado");
    if (faltando.length) return mostrarErro($("erroExec"), `Preencha: ${faltando.join(", ")}.`);

    const dados = {
      id: execEditando?.id,
      caso_id: execCaso.id,
      tester_id: execEditando ? execEditando.tester.id : Number(CE.tester.value),
      status: CE.status.value,
      data: paraBR(CE.data.value),
      observacoes: CE.observacoes.value,
    };
    const nome = (execEditando ? execEditando.tester : testerPorId(dados.tester_id)).nome;
    if (await gravar(formExec, $("erroExec"), () => banco.salvarExec(dados))) {
      casosAbertos.add(execCaso.id);
      renderCasos();
      dlgExec.close();
      toast(`Resultado de ${nomeCurto(nome)} salvo.`);
    }
  });

  $("btnRemoverExec").addEventListener("click", async () => {
    const ex = execEditando;
    if (!ex || gravando) return;
    if (!confirm(`Remover ${ex.tester.nome} do caso “${ex.caso.titulo}”?\nO resultado dessa pessoa nesse caso será apagado.`)) return;
    if (await gravar(formExec, $("erroExec"), () => banco.removerExec(ex.id))) {
      dlgExec.close();
      toast(`${nomeCurto(ex.tester.nome)} removido do caso.`);
    }
  });

  // ============================================================
  //  Modal: novo / editar tester
  // ============================================================
  const dlgTester = $("modalTester");
  const formTester = $("formTester");
  const CT = formTester.elements;
  let testerEditando = null;

  function abrirModalTester(t = null) {
    if (!usuario) return abrirLogin();
    formTester.reset();
    mostrarErro($("erroTester"), "");
    testerEditando = t;
    $("tituloModalTester").textContent = t ? "Editar tester" : "Novo tester";
    $("btnConfirmarTester").textContent = t ? "Salvar alterações" : "Adicionar";
    const podeExcluir = t && !t.feitos;
    $("btnExcluirTester").hidden = !podeExcluir;
    $("dicaExcluirTester").hidden = !t || podeExcluir;
    if (t) {
      CT.nome.value = t.nome;
      CT.usuario.value = t.usuario;
      CT.area.value = t.area;
    }
    preencherListas();
    dlgTester.showModal();
    CT.nome.focus();
  }

  formTester.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (gravando) return;
    const dados = { nome: txt(CT.nome.value), usuario: txt(CT.usuario.value), area: txt(CT.area.value) };
    const faltando = [];
    if (!dados.nome) faltando.push("Nome");
    if (!dados.area) faltando.push("Área");
    if (faltando.length) return mostrarErro($("erroTester"), `Preencha: ${faltando.join(", ")}.`);
    if (testers.some((t) => t.id !== testerEditando?.id && chave(t.nome) === chave(dados.nome)))
      return mostrarErro($("erroTester"), "Já existe um tester com esse nome.");

    const editando = testerEditando;
    if (await gravar(formTester, $("erroTester"), () => banco.salvarTester(editando?.id, dados))) {
      dlgTester.close();
      toast(`${dados.nome} ${editando ? "atualizado" : "adicionado"}.`);
    }
  });

  $("btnExcluirTester").addEventListener("click", async () => {
    const t = testerEditando;
    if (!t || gravando) return;
    const n = t.execs.length;
    const aviso = n ? `\n\nAs ${n} atribuições pendentes dessa pessoa também serão removidas.` : "";
    if (!confirm(`Excluir ${t.nome}?${aviso}`)) return;
    if (await gravar(formTester, $("erroTester"), () => banco.excluirTester(t.id))) {
      dlgTester.close();
      toast(`${t.nome} excluído.`);
    }
  });

  $("btnNovoTester").addEventListener("click", () => abrirModalTester());

  // ============================================================
  //  Modal: atribuir casos a um tester
  // ============================================================
  const dlgAtribuir = $("modalAtribuir");
  const formAtribuir = $("formAtribuir");
  let testerAtribuir = null;
  const marcados = new Set();

  function abrirModalAtribuir(t) {
    if (!usuario) return abrirLogin();
    testerAtribuir = t;
    marcados.clear();
    mostrarErro($("erroAtribuir"), "");
    $("buscaAtribuir").value = "";
    $("tituloModalAtribuir").textContent = `Atribuir casos a ${nomeCurto(t.nome)}`;
    renderListaAtribuir();
    dlgAtribuir.showModal();
    $("buscaAtribuir").focus();
  }

  function renderListaAtribuir() {
    const t = testerAtribuir;
    const ja = new Set(t.execs.map((e) => e.caso.id));
    const termo = chave($("buscaAtribuir").value);
    const lista = [...casos]
      .sort((a, b) => a.modulo.localeCompare(b.modulo, "pt-BR") || a.titulo.localeCompare(b.titulo, "pt-BR"))
      .filter((c) => !termo || `${c.titulo} ${c.modulo}`.toLowerCase().includes(termo));

    $("listaAtribuir").innerHTML = lista.length
      ? lista
          .map((c) => {
            const atribuido = ja.has(c.id);
            return `
            <label class="pop-op${atribuido ? " zerado" : ""}">
              <input type="checkbox" value="${c.id}" ${atribuido || marcados.has(c.id) ? "checked" : ""} ${atribuido ? "disabled" : ""} />
              <i class="ponto" style="background:${STATUS[c.status].cor}" title="${STATUS[c.status].label}"></i>
              <span class="pop-nome">${esc(c.titulo)} <small class="apagado">· ${esc(c.modulo)}</small></span>
              ${atribuido ? `<span class="pop-num">já atribuído</span>` : ""}
            </label>`;
          })
          .join("")
      : `<p class="pop-vazio">Nenhum caso encontrado.</p>`;
    $("contAtribuir").textContent = marcados.size ? `${marcados.size} selecionado${marcados.size > 1 ? "s" : ""}` : "";
  }

  $("buscaAtribuir").addEventListener("input", renderListaAtribuir);
  $("listaAtribuir").addEventListener("change", (e) => {
    if (e.target.type !== "checkbox") return;
    const id = Number(e.target.value);
    e.target.checked ? marcados.add(id) : marcados.delete(id);
    renderListaAtribuir();
  });
  // Enter na busca não envia o formulário
  $("buscaAtribuir").addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); });

  formAtribuir.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (gravando) return;
    if (!marcados.size) return mostrarErro($("erroAtribuir"), "Marque pelo menos um caso.");
    const t = testerAtribuir;
    const n = marcados.size;
    if (await gravar(formAtribuir, $("erroAtribuir"), () => banco.atribuir(t.id, [...marcados]))) {
      dlgAtribuir.close();
      toast(`${n} caso${n > 1 ? "s" : ""} atribuído${n > 1 ? "s" : ""} a ${nomeCurto(t.nome)}.`);
    }
  });

  // ============================================================
  //  Render geral e inicialização
  // ============================================================
  function renderTudo() {
    renderPeriodo();
    renderResumo();
    filtrosCasos.render();
    renderCasos();
    filtrosTesters.render();
    renderTesters();
    renderAcesso();
  }

  async function iniciar() {
    mostrarAba(location.hash === "#testers" ? "testers" : "casos");
    renderTudo();
    $("contagemCasos").textContent = "Carregando…";
    $("contagemTesters").textContent = "Carregando…";
    $("vazioCasos").hidden = $("vazioTesters").hidden = true;
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
      await carregar();
      renderTudo();
    } catch (err) {
      $("contagemCasos").textContent = $("contagemTesters").textContent = "";
      $("vazioCasos").hidden = false;
      $("vazioCasos").textContent = `Não foi possível carregar os dados: ${err.message}`;
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
