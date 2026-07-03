import { useState, useRef, useEffect } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import { createWorker } from "tesseract.js";
import PageHeader from "../components/ui/PageHeader";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  is_discount: boolean;
  discount_percent: number;
  confidence: number;
}

const UNIT_LABELS: Record<string, string> = {
  gram: "g", kilogram: "kg", milliliter: "ml", liter: "l",
  piece: "pcs", pack: "pack", bottle: "bottle", box: "box",
  can: "can", jar: "jar", bag: "bag", sachet: "sachet",
};

const UNIT_ALIASES: Record<string, string[]> = {
  gram: ["g", "gr", "gram", "grams", "grama", "gramas"],
  kilogram: ["kg", "kilo", "kilos", "quilograma", "quilogramas"],
  milliliter: ["ml", "milliliter", "milliliters", "mililitro", "mililitros"],
  liter: ["l", "lt", "liter", "liters", "litro", "litros"],
  piece: ["pcs", "pc", "piece", "pieces", "un", "unidade", "unidades", "unid"],
  pack: ["pack", "pacote", "pacotes", "pk", "pkg"],
  bottle: ["bottle", "bottles", "garrafa", "garrafas", "btl"],
  box: ["box", "boxes", "caixa", "caixas", "bx"],
  can: ["can", "cans", "lata", "latas", "tn"],
  jar: ["jar", "jars", "frasco", "frascos"],
  bag: ["bag", "bags", "saco", "sacos"],
  sachet: ["sachet", "sachets", "saqueta", "saquetas"],
};

export default function ReceiptScannerPage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | "">("");
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("Aguardar imagem…");
  const { showToast } = useToast();
  const [showResults, setShowResults] = useState(false);
  const [importSummary, setImportSummary] = useState<{ count: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<any>(null);

  useEffect(() => {
    loadIngredients();
    loadSuppliers();
    initWorker();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initWorker = async () => {
    try {
      const worker = await createWorker("por", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setOcrProgress(`OCR: ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            setOcrProgress(m.status);
          }
        },
      });
      workerRef.current = worker;
      setOcrProgress("Modelo OCR pronto");
    } catch (e) {
      setOcrProgress("Erro ao carregar OCR");
      showToast("Falha ao inicializar Tesseract.js", "err");
    }
  };

  const loadIngredients = async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch { showToast("Erro ao carregar ingredientes", "err"); }
  };

  const loadSuppliers = async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch { showToast("Erro ao carregar fornecedores", "err"); }
  };

  const parseReceiptText = (text: string): ParsedLine[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);
    const results: ParsedLine[] = [];

    const priceRegex = /(\d+[.,]\d{2})\s*[€$]?/g;
    const qtyUnitRegex = /(\d+[.,]?\d*)\s*(g|kg|ml|l|pcs|pc|un|unid|unidade|pack|pacote|bottle|garrafa|box|caixa|can|lata|jar|frasco|bag|saco|sachet|saqueta)/gi;

    for (const line of lines) {
      const prices = [...line.matchAll(priceRegex)].map(m => parseFloat(m[1].replace(",", ".")));
      const qtyMatches = [...line.matchAll(qtyUnitRegex)];
      const lastPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
      const firstQtyMatch = qtyMatches[0];

      let qty = 1;
      let unit = "piece";
      if (firstQtyMatch) {
        qty = parseFloat(firstQtyMatch[1].replace(",", "."));
        const matchedUnit = firstQtyMatch[2].toLowerCase();
        for (const [stdUnit, aliases] of Object.entries(UNIT_ALIASES)) {
          if (aliases.includes(matchedUnit)) { unit = stdUnit; break; }
        }
      }

      let name = line;
      if (firstQtyMatch) name = name.replace(firstQtyMatch[0], "").trim();
      prices.forEach(p => { name = name.replace(p.toString().replace(".", ","), "").trim(); });
      name = name.replace(/^[\d\s\.\-\*\+]+/, "").replace(/[€$]/g, "").trim();

      if (name.length < 3 || lastPrice === 0) continue;

      const isDiscount = /promo|desconto|oferta|sale|-%/i.test(line);
      let discountPercent = 0;
      const discountMatch = line.match(/(\d+)\s*%/);
      if (discountMatch) discountPercent = parseInt(discountMatch[1]);

      const existingIng = ingredients.find(i =>
        i.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]) ||
        name.toLowerCase().includes(i.name.toLowerCase().split(" ")[0])
      );

      results.push({
        name: existingIng?.name ?? name,
        quantity: qty,
        unit: existingIng?.unit ?? unit,
        price: lastPrice,
        is_discount: isDiscount,
        discount_percent: discountPercent,
        confidence: existingIng ? 0.9 : 0.5,
      });
    }

    return results;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Seleciona um ficheiro de imagem", "warn");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => { setImage(ev.target?.result as string); setParsedLines([]); setShowResults(false); };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      await new Promise(r => { video.onloadeddata = r; });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setImage(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      setImageFile(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      setParsedLines([]);
      setShowResults(false);
    } catch (e) {
      showToast("Erro ao aceder à câmara", "err");
    }
  };

  const runOCR = async () => {
    if (!imageFile || !workerRef.current) return;
    setProcessing(true);
    setOcrProgress("A processar…");
    try {
      const { data: { text } } = await workerRef.current.recognize(imageFile);
      const parsed = parseReceiptText(text);
      setParsedLines(parsed);
      setShowResults(true);
      setOcrProgress(`${parsed.length} linhas detectadas`);
      showToast(`${parsed.length} itens extraídos`, parsed.length > 0 ? "ok" : "warn");
    } catch (e) {
      showToast("Erro no OCR", "err");
      setOcrProgress("Erro no OCR");
    } finally {
      setProcessing(false);
    }
  };

  const updateLine = (idx: number, field: keyof ParsedLine, value: any) => {
    setParsedLines(l => l.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const findOrCreateIngredient = async (line: ParsedLine): Promise<number> => {
    let ing = ingredients.find(i => i.name.toLowerCase() === line.name.toLowerCase());
    if (ing) return ing.id;
    try {
      const newIngredient = await invoke<{ id: number }>("ingredient_create", {
        input: {
          name: line.name,
          unit: line.unit,
          price_per_unit: line.price,
          category: "outros",
        },
      });
      const newId = newIngredient.id;
      await loadIngredients();
      return newId;
    } catch { throw new Error(`Falha ao criar ingrediente: ${line.name}`); }
  };

  const confirmImport = async () => {
    if (parsedLines.length === 0) { showToast("Nada para importar", "warn"); return; }
    setProcessing(true);
    try {
      for (const line of parsedLines) {
        const ingId = await findOrCreateIngredient(line);
        const total = line.quantity * line.price;
        await invoke("stock_purchase_add", {
          input: {
            ingredient_id: ingId,
            quantity: line.quantity,
            unit: line.unit,
            price_per_unit: line.price,
            total_price: total,
            is_discount: line.is_discount,
            discount_percent: line.discount_percent,
            purchase_date: new Date().toISOString(),
            supplier_id: selectedSupplier ? selectedSupplier : null,
            notes: "Importado via OCR de talão",
          },
        });
      }
      showToast(`${parsedLines.length} compras registadas e stock actualizado`, "ok");
      setImportSummary({
        count: parsedLines.length,
        total: parsedLines.reduce((s, l) => s + l.quantity * l.price, 0),
      });
      setParsedLines([]);
      setShowResults(false);
      setImage(null);
      setImageFile(null);
    } catch (e) {
      showToast("Erro ao importar", "err");
    } finally {
      setProcessing(false);
    }
  };

  const resetAll = () => {
    setImage(null);
    setImageFile(null);
    setParsedLines([]);
    setShowResults(false);
    setSelectedSupplier("");
    setOcrProgress("Aguardar imagem…");
    setImportSummary(null);
  };

  const goBackToExtract = () => {
    setShowResults(false);
  };

  // Step index for the indicator bar: 0 upload, 1 extract, 2 review, 3 confirm.
  const currentStep = importSummary ? 3 : showResults ? 2 : image ? 1 : 0;
  const STEP_META = [
    { label: "Carregar", icon: "upload_file" },
    { label: "Extração", icon: "document_scanner" },
    { label: "Revisão", icon: "edit_note" },
    { label: "Confirmar", icon: "task_alt" },
  ];

  const matchMeta = (confidence: number): { color: string; icon: string; label: string } =>
    confidence > 0.7
      ? { color: "var(--green)", icon: "check_circle", label: "Reconhecido" }
      : confidence > 0.4
      ? { color: "var(--amber)", icon: "add_circle", label: "Novo item" }
      : { color: "var(--red)", icon: "help", label: "Verificar" };

  const reviewTotal = parsedLines.reduce((s, l) => s + l.quantity * l.price, 0);
  const reviewNewCount = parsedLines.filter(l => l.confidence <= 0.7).length;

  return (
    <div className="content">
      <PageHeader
        title="Scanner de Talões"
        subtitle="OCR local via Tesseract.js"
        actions={
          <button className="btn" onClick={resetAll} disabled={!image && parsedLines.length === 0 && !importSummary}>
            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">refresh</span>
            Novo scan
          </button>
        }
      />

      {/* step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: "14px 20px", marginBottom: 20 }}>
        {STEP_META.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, flex: i < STEP_META.length - 1 ? "0 0 auto" : "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
                  background: i < currentStep ? "var(--green)" : i === currentStep ? "var(--ember)" : "var(--inset)",
                  color: i <= currentStep ? "#fff" : "var(--ink-3)",
                  border: i === currentStep || i < currentStep ? "none" : "1px solid var(--line)",
                }}
              >
                <span className="ms" style={{ fontSize: 17 }} aria-hidden="true">{s.icon}</span>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: i <= currentStep ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < STEP_META.length - 1 && <div style={{ flex: 1, height: 1, background: "var(--line)", minWidth: 14 }} />}
          </div>
        ))}
      </div>

      {/* step 3: confirm — checked first, since after import image/showResults are already reset */}
      {importSummary ? (
        <div className="card" style={{ borderRadius: 16, padding: 48, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-soft)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <span className="ms" style={{ fontSize: 34, color: "var(--green)" }} aria-hidden="true">task_alt</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", marginTop: 16 }}>Compra importada</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 6 }}>{importSummary.count} itens adicionados ao stock e histórico</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>Importados</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{importSummary.count}</div>
            </div>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>Gasto</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ember)", marginTop: 3 }}>{importSummary.total.toFixed(2)} €</div>
            </div>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>Stock</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--green)", marginTop: 3 }}>✓</div>
            </div>
          </div>
          <button className="btn" onClick={resetAll} style={{ marginTop: 28 }}>Digitalizar outro</button>
        </div>
      ) : !image && !showResults ? (
        /* step 0: upload */
        <div className="card" style={{ border: "2px dashed var(--line)", borderRadius: 16, padding: 56, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--ember-soft)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <span className="ms" style={{ fontSize: 32, color: "var(--ember)" }} aria-hidden="true">photo_camera</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", marginTop: 18 }}>Fotografa ou carrega o talão</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Extraímos os itens automaticamente. Revê e corrige antes de importar para o stock. Suporta JPG, PNG, WebP — o OCR corre localmente no browser (português).
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <label className="btn-primary" style={{ cursor: "pointer" }}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">upload</span>
              Escolher ficheiro
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
            </label>
            <button className="btn-secondary" style={{ height: 42, padding: "0 20px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }} onClick={handleCameraCapture}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">photo_camera</span>
              Usar câmara
            </button>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6 }}>Desktop: usa "Escolher ficheiro". Mobile: "Usar câmara" abre a câmara traseira.</p>
        </div>
      ) : image && !showResults ? (
        /* step 1: extract */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 14, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, position: "relative", background: "var(--inset)", overflow: "hidden" }}>
            <span className="mono" style={{ position: "absolute", top: 14, left: 14, fontSize: 10, color: "var(--ink-3)", background: "var(--surface)", padding: "3px 8px", borderRadius: 6, zIndex: 1 }}>
              TALÃO · {(imageFile?.name || "receipt.jpg").toUpperCase()}
            </span>
            <img src={image!} alt="Talão carregado" style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, objectFit: "contain" }} />
          </div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: processing ? "var(--ember)" : "var(--ink-2)" }}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">{processing ? "hourglass_top" : "document_scanner"}</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{processing ? "A extrair texto…" : "Pronto para extrair texto"}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.9, marginTop: 14, background: "var(--inset)", borderRadius: 10, padding: 14 }}>
              {ocrProgress}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={resetAll}>Cancelar</button>
              <button className="btn-primary" onClick={runOCR} disabled={processing} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {processing ? (
                  <span className="ms animate-spin" style={{ fontSize: 18 }} aria-hidden="true">progress_activity</span>
                ) : (
                  <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">arrow_forward</span>
                )}
                {processing ? "A processar…" : "Extrair texto (OCR)"}
              </button>
            </div>
          </div>
        </div>
      ) : showResults && parsedLines.length > 0 ? (
        /* step 2: review */
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--amber-soft)" }}>
            <span className="ms" style={{ fontSize: 19, color: "var(--amber)" }} aria-hidden="true">edit_note</span>
            <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, flex: 1 }}>Confirma os itens extraídos. Alguns precisam de atenção.</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>{reviewNewCount} a verificar</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 90px 90px 100px 1fr 90px 36px", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--line)", background: "var(--inset)" }}>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Nome</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Qtd.</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Unidade</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)", textAlign: "right" }}>Preço</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Correspondência</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>Promoção</span>
            <span></span>
          </div>

          {parsedLines.map((line, idx) => {
            const m = matchMeta(line.confidence);
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "1.7fr 90px 90px 100px 1fr 90px 36px", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--line-2)", alignItems: "center" }}>
                <input
                  value={line.name}
                  onChange={e => updateLine(idx, "name", e.target.value)}
                  placeholder="Nome do ingrediente"
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 10px", fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink)", width: "100%" }}
                />
                <input
                  type="number" min="0.01" step="0.01" value={line.quantity}
                  onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                  className="mono"
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 8px", fontSize: 12.5, color: "var(--ink)", width: "100%" }}
                />
                <select
                  value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)}
                  className="mono"
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 6px", fontSize: 11.5, color: "var(--ink)", width: "100%" }}
                >
                  {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>€</span>
                  <input
                    type="number" min="0" step="0.01" value={line.price}
                    onChange={e => updateLine(idx, "price", parseFloat(e.target.value) || 0)}
                    className="mono"
                    style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 8px", fontSize: 12.5, color: "var(--ink)", width: 66, textAlign: "right" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="ms" style={{ fontSize: 17, color: m.color }} aria-hidden="true">{m.icon}</span>
                  <span style={{ fontSize: 11.5, color: m.color, fontWeight: 500 }}>{m.label}</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={line.is_discount} onChange={e => updateLine(idx, "is_discount", e.target.checked)} />
                  {line.is_discount && (
                    <input
                      type="number" min="0" max="100" value={line.discount_percent}
                      onChange={e => updateLine(idx, "discount_percent", parseInt(e.target.value) || 0)}
                      placeholder="%"
                      className="mono"
                      style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 28, padding: "0 6px", fontSize: 11, color: "var(--ink)", width: 44 }}
                    />
                  )}
                </label>
                <button
                  onClick={() => setParsedLines(l => l.filter((_, i) => i !== idx))}
                  title="Remover" aria-label="Remover linha"
                  style={{ width: 30, height: 30, border: "none", background: "transparent", borderRadius: 7, cursor: "pointer", color: "var(--ink-3)", display: "grid", placeItems: "center" }}
                >
                  <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">close</span>
                </button>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--inset)", gap: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={goBackToExtract}>← Voltar</button>
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value ? parseInt(e.target.value) : "")} style={{ height: 38 }}>
                <option value="">Fornecedor — Nenhum —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{parsedLines.length} ingredientes · {reviewTotal.toFixed(2)} €</span>
              <button className="btn-primary" onClick={confirmImport} disabled={processing} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="ms" style={{ fontSize: 17 }} aria-hidden="true">check</span>
                {processing ? "A importar…" : "Importar para stock"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* step 2 (empty result) */
        <div className="empty">
          <span className="ms" style={{ fontSize: 40, color: "var(--ink-3)" }} aria-hidden="true">search_off</span>
          <h2 className="empty-title">Nenhum item detectado</h2>
          <p style={{ color: "var(--ink-2)", fontSize: 13, maxWidth: 380 }}>O OCR não encontrou linhas com padrão preço/quantidade reconhecível. Tenta uma foto mais nítida ou edita manualmente.</p>
          <button className="btn-primary" onClick={resetAll} style={{ marginTop: 8 }}>Tentar outra imagem</button>
        </div>
      )}
    </div>
  );
}