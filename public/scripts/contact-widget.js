(function () {
    // Only run on the contact page
    if (window.location.pathname !== '/contacto/') return;

    // Configuration
    const API_URL = 'https://admin.tubular.com.ar/api/storefront/contact';
    // ^ Change this to your production API URL if different

    // Function to render our custom form
    function renderCustomForm() {
        const container = document.querySelector('.contact-page') || document.querySelector('.page-content') || document.querySelector('.container-fluid');
        if (!container) return;

        // Hide default form
        const defaultForm = document.querySelector('form[action="/contacto/"]');
        if (defaultForm) {
            defaultForm.style.display = 'none';
        }

        // Create custom form container
        const customContainer = document.createElement('div');
        customContainer.className = 'custom-contact-form-container';
        customContainer.innerHTML = `
            <style>
                .custom-contact-form {
                    max-w-[600px] margin: 0 auto;
                    font-family: inherit;
                }
                .custom-contact-form-group {
                    margin-bottom: 20px;
                }
                .custom-contact-form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #333;
                }
                .custom-contact-form-group input,
                .custom-contact-form-group textarea {
                    width: 100%;
                    padding: 12px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    font-family: inherit;
                    font-size: 16px;
                }
                .custom-contact-form-group textarea {
                    min-height: 120px;
                    resize: vertical;
                }
                .custom-contact-submit {
                    background-color: #000;
                    color: #fff;
                    padding: 14px 24px;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    width: 100%;
                    transition: opacity 0.2s;
                }
                .custom-contact-submit:hover {
                    opacity: 0.8;
                }
                .custom-contact-submit:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }
                .custom-contact-message {
                    margin-top: 20px;
                    padding: 16px;
                    border-radius: 8px;
                    display: none;
                }
                .custom-contact-message.success {
                    display: block;
                    background-color: #e6f4ea;
                    color: #1e8e3e;
                    border: 1px solid #1e8e3e;
                }
                .custom-contact-message.error {
                    display: block;
                    background-color: #fce8e6;
                    color: #d93025;
                    border: 1px solid #d93025;
                }
            </style>
            
            <form id="tubular-contact-form" class="custom-contact-form">
                <div class="custom-contact-form-group">
                    <label for="contact-name">Nombre</label>
                    <input type="text" id="contact-name" name="name" required placeholder="Tu nombre completo">
                </div>
                <div class="custom-contact-form-group">
                    <label for="contact-email">Email</label>
                    <input type="email" id="contact-email" name="email" placeholder="tu@email.com">
                </div>
                <div class="custom-contact-form-group">
                    <label for="contact-phone">Teléfono (opcional)</label>
                    <input type="tel" id="contact-phone" name="phone" placeholder="+54 9 11 1234 5678">
                </div>
                <div class="custom-contact-form-group">
                    <label for="contact-message">Mensaje</label>
                    <textarea id="contact-message" name="message" required placeholder="¿En qué te podemos ayudar?"></textarea>
                </div>
                <button type="submit" id="contact-submit" class="custom-contact-submit">Enviar Mensaje</button>
                <div id="contact-response-message" class="custom-contact-message"></div>
            </form>
        `;

        // Insert our custom form nearby, normally before the default one, or inside the container
        if (defaultForm && defaultForm.parentNode) {
            defaultForm.parentNode.insertBefore(customContainer, defaultForm);
        } else {
            container.appendChild(customContainer);
        }

        // Handle submission
        const form = document.getElementById('tubular-contact-form');
        const submitBtn = document.getElementById('contact-submit');
        const responseMsg = document.getElementById('contact-response-message');

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
            responseMsg.className = 'custom-contact-message'; // reset

            const formData = new FormData(form);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                message: formData.get('message')
            };

            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        responseMsg.textContent = '¡Gracias! Hemos recibido tu mensaje. Te responderemos a la brevedad.';
                        responseMsg.className = 'custom-contact-message success';
                        form.reset();
                    } else {
                        throw new Error(data.error || 'Error al enviar');
                    }
                })
                .catch(err => {
                    console.error('Submission error:', err);
                    responseMsg.textContent = 'Ups, hubo un problema al enviar tu mensaje. Por favor intenta de nuevo o escríbenos a nuestro correo.';
                    responseMsg.className = 'custom-contact-message error';
                })
                .finally(() => {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Enviar Mensaje';
                });
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderCustomForm);
    } else {
        renderCustomForm();
    }
})();
