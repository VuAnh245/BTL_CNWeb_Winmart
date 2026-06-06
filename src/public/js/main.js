/* =========================================================
   WINMART FRONTEND SYSTEM
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    initPasswordToggle();

    initPasswordStrength();

    initFlashAutoClose();

    initNavbarScroll();

    initBackToTop();

    initButtonLoading();

    initSmoothAnchor();

    initAddToCart();

});

/* =========================================================
   PASSWORD TOGGLE
========================================================= */

function initPasswordToggle(){

    const toggles =
        document.querySelectorAll('.password-toggle');

    if(!toggles.length) return;

    toggles.forEach(toggle => {

        toggle.addEventListener('click', () => {

            const wrapper =
                toggle.closest('.password-wrapper');

            if(!wrapper) return;

            const input =
                wrapper.querySelector('input');

            const icon =
                toggle.querySelector('i');

            if(!input || !icon) return;

            const isPassword =
                input.type === 'password';

            input.type =
                isPassword ? 'text' : 'password';

            icon.className =
                isPassword
                    ? 'bi bi-eye-slash'
                    : 'bi bi-eye';

        });

    });

}

/* =========================================================
   PASSWORD STRENGTH
========================================================= */

function initPasswordStrength(){

    const passwordInput =
        document.getElementById('passwordInput');

    if(!passwordInput) return;

    const strengthBar =
        document.querySelector('.strength-bar');

    const strengthText =
        document.querySelector('.strength-text');

    if(!strengthBar || !strengthText) return;

    passwordInput.addEventListener('input', () => {

        const value =
            passwordInput.value.trim();

        let strength = 0;

        if(value.length >= 8) strength++;

        if(/[A-Z]/.test(value)) strength++;

        if(/[0-9]/.test(value)) strength++;

        if(/[^A-Za-z0-9]/.test(value)) strength++;

        const percent =
            (strength / 4) * 100;

        strengthBar.style.width =
            `${percent}%`;

        /* Weak */

        if(strength <= 1){

            strengthBar.style.background =
                '#ef4444';

            strengthText.textContent =
                'Mật khẩu yếu';

        }

        /* Medium */

        else if(strength <= 2){

            strengthBar.style.background =
                '#f59e0b';

            strengthText.textContent =
                'Mật khẩu trung bình';

        }

        /* Good */

        else if(strength <= 3){

            strengthBar.style.background =
                '#3b82f6';

            strengthText.textContent =
                'Mật khẩu khá mạnh';

        }

        /* Strong */

        else{

            strengthBar.style.background =
                '#10b981';

            strengthText.textContent =
                'Mật khẩu mạnh';

        }

    });

}

/* =========================================================
   AUTO CLOSE FLASH MESSAGE - ĐÃ VÔ HIỆU HÓA
========================================================= */
function initFlashAutoClose(){

    const alerts =
        document.querySelectorAll('.alert');

    if(!alerts.length) return;

    alerts.forEach(alert => {

        setTimeout(() => {

            alert.classList.add('fade');

            setTimeout(() => {

                alert.remove();

            }, 300);

        }, 3500);

    });

}

/* =========================================================
   NAVBAR SCROLL EFFECT
========================================================= */

function initNavbarScroll(){

    const navbar =
        document.querySelector('.modern-navbar');

    if(!navbar) return;

    window.addEventListener('scroll', () => {

        if(window.scrollY > 30){

            navbar.classList.add('navbar-scrolled');

        } else {

            navbar.classList.remove('navbar-scrolled');

        }

    });

}

/* =========================================================
   BACK TO TOP
========================================================= */

function initBackToTop(){

    const button =
        document.createElement('button');

    button.className =
        'back-to-top';

    button.innerHTML =
        '<i class="bi bi-arrow-up"></i>';

    document.body.appendChild(button);

    window.addEventListener('scroll', () => {

        if(window.scrollY > 300){

            button.classList.add('show');

        } else {

            button.classList.remove('show');

        }

    });

    button.addEventListener('click', () => {

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

    });

}

/* =========================================================
   BUTTON LOADING
========================================================= */

function initButtonLoading(){

    const forms =
        document.querySelectorAll('form');

    if(!forms.length) return;

    forms.forEach(form => {

        form.addEventListener('submit', () => {

            const submitButton =
                form.querySelector(
                    'button[type="submit"]'
                );

            if(!submitButton) return;

            submitButton.disabled = true;

            submitButton.dataset.originalText =
                submitButton.innerHTML;

            submitButton.innerHTML = `
                <span
                    class="spinner-border spinner-border-sm me-2"
                ></span>
                Đang xử lý...
            `;

        });

    });

}

/* =========================================================
   SMOOTH SCROLL
========================================================= */

function initSmoothAnchor(){

    const anchors =
        document.querySelectorAll('a[href^="#"]');

    if(!anchors.length) return;

    anchors.forEach(anchor => {

        anchor.addEventListener('click', e => {

            const targetId =
                anchor.getAttribute('href');

            if(targetId === '#') return;

            const target =
                document.querySelector(targetId);

            if(!target) return;

            e.preventDefault();

            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

        });

    });

}

/* =========================================================
   PAGE LOADER
========================================================= */

window.addEventListener('load', () => {

    const loader =
        document.getElementById('page-loader');

    if(!loader) return;

    loader.classList.add('loader-hidden');

    setTimeout(() => {

        loader.remove();

    }, 400);

});

/* =========================================================
   ADD TO CART
========================================================= */

function initAddToCart(){
    const cartButtons = document.querySelectorAll('.add-cart-btn:not(.disabled)');
    
    cartButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const productId = btn.dataset.productId;
            if(!productId) return;
            
            // Show loading state
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;
            
            try {
                const response = await fetch('/cart/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ productId, quantity: 1 })
                });
                
                const data = await response.json();
                
                if(data.success) {
                    // Cập nhật số lượng giỏ hàng trên header nếu có
                    const badge = document.querySelector('.cart-badge');
                    if(badge) {
                        badge.textContent = data.cartCount;
                    } else {
                        // Nếu chưa có badge, tạo mới (tuỳ logic UI)
                        const cartIcon = document.querySelector('.cart-icon');
                        if (cartIcon) {
                            cartIcon.innerHTML += `<span class="cart-badge">${data.cartCount}</span>`;
                        }
                    }
                    
                    // Hiển thị thông báo (toast/alert)
                    alert('Đã thêm sản phẩm vào giỏ hàng thành công!');
                } else {
                    alert(data.message || 'Có lỗi xảy ra.');
                }
            } catch (error) {
                console.error(error);
                alert('Có lỗi xảy ra khi thêm vào giỏ hàng.');
            } finally {
                // Restore button state
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });
    });
}