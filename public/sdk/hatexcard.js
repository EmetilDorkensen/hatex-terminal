// public/sdk/hatexcard.js
(function() {
    "use strict";
  
    const HATEX_API = 'https://sitwou.com/api'; // Chanje ak domèn ou a
    
    window.HatexCard = {
      init: function(config) {
        this.merchantId = config.merchantId;
        this.apiKey = config.apiKey;
        this.mode = config.mode || 'live'; // 'live' oswa 'test'
        
        // Chèche bouton "Ajouter au panier" sou paj la
        this.injectButton();
      },
  
      injectButton: function() {
        const btnSelectors = [
          '.single_add_to_cart_button',
          'button[name="add-to-cart"]',
          '.add_to_cart_button',
          '#add-to-cart'
        ];
  
        btnSelectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(btn => {
            if (btn.dataset.hatexInjected) return;
  
            // Kreye bouton Hatex la
            const hatexBtn = document.createElement('button');
            hatexBtn.className = 'hatex-pay-btn';
            hatexBtn.innerHTML = '💳 Peye ak HatexCard';
            hatexBtn.style.cssText = `
              background: #e62e04;
              color: white;
              width: 100%;
              padding: 14px;
              border: none;
              border-radius: 8px;
              margin-top: 10px;
              cursor: pointer;
              font-weight: bold;
            `;
  
            hatexBtn.onclick = (e) => {
              e.preventDefault();
              this.startPayment();
            };
  
            btn.parentNode.insertBefore(hatexBtn, btn.nextSibling);
            btn.dataset.hatexInjected = 'true';
          });
        });
      },
  
      startPayment: async function() {
        // 1. Kolekte enfòmasyon pwodwi a
        const productData = {
          name: document.querySelector('h1')?.innerText || document.title,
          price: this.extractPrice(),
          qty: this.extractQuantity(),
          variant: this.extractVariant()
        };
  
        // 2. Kreye yon sesyon peman sou backend la
        const response = await fetch(`${HATEX_API}/payments/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Merchant-ID': this.merchantId,
            'X-API-Key': this.apiKey
          },
          body: JSON.stringify({
            amount: productData.price,
            currency: 'HTG',
            description: productData.name,
            metadata: productData,
            returnUrl: window.location.origin + '/payment-success'
          })
        });
  
        const data = await response.json();
        
        if (data.paymentUrl) {
          // 3. Redireksyon kliyan an nan paj peman Hatex
          window.location.href = data.paymentUrl;
        }
      },
  
      extractPrice: function() {
        const priceEl = document.querySelector('.price .amount, .product-price, .price');
        if (priceEl) {
          return parseFloat(priceEl.innerText.replace(/[^\d.]/g, ''));
        }
        return 0;
      },
  
      extractQuantity: function() {
        const qtyEl = document.querySelector('input.qty, input[name="quantity"]');
        return qtyEl ? parseInt(qtyEl.value) || 1 : 1;
      },
  
      extractVariant: function() {
        const parts = [];
        document.querySelectorAll('select.variations select, .variations select').forEach(select => {
          const opt = select.options[select.selectedIndex];
          if (opt && opt.text) parts.push(opt.text.trim());
        });
        return parts.join(' · ') || 'Inite';
      }
    };
  })();