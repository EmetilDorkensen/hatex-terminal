// public/sdk-hatex.js
(function() {
    // 1. Rekipere konfigirasyon nan script tag la
    const script = document.currentScript;
    const terminalId = script.dataset.terminal || script.dataset.key; // Sipòte tou de non yo
    const amount = script.dataset.amount || "0";
    const containerId = script.dataset.container;

    // 2. Kreye Bouton Peye a ak Style Hatex la
    const payBtn = document.createElement('button');
    payBtn.innerHTML = `
        <img src="https://hatexcard.com/logo-hatex.png" style="width:18px; filter: brightness(0) invert(1);"> 
        <span>PEYE AK HATEXCARD</span>
    `;
    
    // Style pwofesyonèl pou bouton an
    payBtn.style.cssText = `
        background: #dc2626; 
        color: white; 
        padding: 14px 24px; 
        border-radius: 12px; 
        font-weight: 900; 
        border: none; 
        cursor: pointer; 
        font-family: sans-serif;
        font-style: italic; 
        display: inline-flex; 
        align-items: center; 
        gap: 12px;
        transition: all 0.3s ease;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-size: 13px;
        box-shadow: 0 10px 15px -3px rgba(220, 38, 38, 0.3);
    `;

    // Hover effect
    payBtn.onmouseover = () => payBtn.style.transform = "translateY(-2px)";
    payBtn.onmouseout = () => payBtn.style.transform = "translateY(0)";

    // 3. Mete bouton an nan container a oswa nan body a
    if (containerId && document.getElementById(containerId)) {
        document.getElementById(containerId).appendChild(payBtn);
    } else {
        document.body.appendChild(payBtn);
    }

    // 4. Kreye Modal la
    const modal = document.createElement('div');
    modal.style.cssText = `
        display: none; 
        position: fixed; 
        inset: 0; 
        background: rgba(0,0,0,0.9); 
        z-index: 999999; 
        align-items: center; 
        justify-content: center; 
        font-family: sans-serif;
        backdrop-filter: blur(5px);
    `;

    modal.innerHTML = `
        <div style="background:#0a0b14; width:90%; max-width:400px; padding:40px; border-radius:40px; border:1px solid rgba(255,255,255,0.05); text-align:center; color:white; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="margin-bottom:25px;">
                <h2 style="color:#dc2626; font-size:14px; font-weight:900; margin:0; letter-spacing:4px; font-style:italic;">HATEX TERMINAL</h2>
                <p style="font-size:9px; color:#555; margin-top:5px;">SECURE CHECKOUT</p>
            </div>

            <div style="background:rgba(255,255,255,0.02); padding:20px; border-radius:25px; margin-bottom:25px; border:1px dashed rgba(255,255,255,0.1);">
                <p style="font-size:10px; color:#888; margin:0;">MONTAN POU PEYE</p>
                <p style="font-size:28px; font-weight:900; color:white; margin:5px 0;">${amount} <span style="font-size:12px;">HTG</span></p>
            </div>
            
            <div style="text-align:left; display:flex; flex-direction:column; gap:12px;">
                <input type="text" id="htx_name" placeholder="NOM SOU KAT LA" style="width:100%; background:#16171d; border:1px solid #222; padding:16px; border-radius:15px; color:white; font-size:12px; outline:none; box-sizing:border-box;">
                <input type="text" id="htx_number" placeholder="KOD KAT (16 CHIF)" maxlength="16" style="width:100%; background:#16171d; border:1px solid #222; padding:16px; border-radius:15px; color:white; text-align:center; letter-spacing:3px; outline:none; box-sizing:border-box;">
                
                <div style="display:flex; gap:10px;">
                    <input type="text" id="htx_exp" placeholder="MM/YY" maxlength="5" style="width:50%; background:#16171d; border:1px solid #222; padding:16px; border-radius:15px; color:white; text-align:center; outline:none; box-sizing:border-box;">
                    <input type="password" id="htx_cvv" placeholder="CVV" maxlength="3" style="width:50%; background:#16171d; border:1px solid #222; padding:16px; border-radius:15px; color:white; text-align:center; outline:none; box-sizing:border-box;">
                </div>

                <button id="htx_confirm" style="width:100%; background:#dc2626; color:white; padding:20px; border-radius:20px; border:none; font-weight:900; cursor:pointer; font-size:13px; margin-top:10px; transition:0.3s;">KONFIME PEMAN AN</button>
            </div>

            <button id="htx_close" style="margin-top:20px; background:none; border:none; color:#444; cursor:pointer; font-size:10px; font-weight:bold; text-transform:uppercase;">Anile Peman</button>
        </div>
    `;

    document.body.appendChild(modal);

    // 5. Lojik Bouton yo
    payBtn.onclick = () => modal.style.display = 'flex';
    document.getElementById('htx_close').onclick = () => modal.style.display = 'none';

    document.getElementById('htx_confirm').onclick = async function() {
        const name = document.getElementById('htx_name').value;
        const number = document.getElementById('htx_number').value;
        const exp = document.getElementById('htx_exp').value;
        const cvv = document.getElementById('htx_cvv').value;
        const btn = this;

        if (!name || number.length < 16 || !exp || !cvv) {
            alert("Tanpri ranpli tout enfòmasyon kat la.");
            return;
        }

        btn.disabled = true;
        btn.innerHTML = "VERIFIKASYON...";
        btn.style.opacity = "0.5";

        // Redireksyon sou paj checkout la ak done yo
        // NÒT: Nan yon sistèm pwodiksyon, li pi bon pou w voye sa via POST
        const queryParams = new URLSearchParams({
            terminal: terminalId,
            amount: amount,
            card_name: name,
            card_number: number,
            exp: exp,
            cvv: cvv
        });

        window.location.href = `https://hatexcard.com/checkout?${queryParams.toString()}`;
    };
})();