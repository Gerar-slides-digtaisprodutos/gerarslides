'use client';

import { nanoid } from 'nanoid';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useState } from 'react';

// SCRIPT DO IFRAME
const SCRIPT_PREVIEW = `<script id="editor-magic-script">
    let modoEdicao = false;
    let elSelecionado = null;

    if (!document.getElementById('builder-core-styles')) {
        const style = document.createElement('style');
        style.id = 'builder-core-styles';
        style.innerHTML = \`body.builder-editing * { cursor: crosshair !important; }\`;
        document.head.appendChild(style);
    }

    function rgbToHex(rgb) {
        if(!rgb || rgb === 'rgba(0, 0, 0, 0)' || rgb === 'transparent') return '';
        let res = rgb.match(/\\d+/g);
        if(!res || res.length < 3) return '';
        return "#" + res.slice(0, 3).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    function sendCleanHtml() {
        let outlineAntigo = '';
        if(elSelecionado) { outlineAntigo = elSelecionado.style.outline; elSelecionado.style.outline = ''; }
        let htmlStr = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;
        if(elSelecionado) { elSelecionado.style.outline = outlineAntigo; }
        window.parent.postMessage({ type: 'HTML_SYNC', html: htmlStr }, '*');
    }

    function selectElement(targetEl) {
        if (targetEl.tagName === 'BODY' || targetEl.tagName === 'HTML') return;

        if(elSelecionado) { elSelecionado.style.outline = ''; elSelecionado.style.outlineOffset = ''; }
        elSelecionado = targetEl;
        elSelecionado.style.outline = '3px solid #4f46e5';
        elSelecionado.style.outlineOffset = '-3px';

        if(!elSelecionado.id) elSelecionado.id = 'node_' + Math.random().toString(36).substr(2,9);

        let isContainer = Array.from(elSelecionado.children).some(child => child.tagName !== 'BR');
        let isNavOrSection = ['SECTION', 'NAV', 'HEADER', 'FOOTER', 'UL', 'DIV', 'ARTICLE', 'DETAILS'].includes(elSelecionado.tagName);
        let bloqueiaTexto = isContainer && isNavOrSection;

        let compStyle = window.getComputedStyle(elSelecionado);
        let isImg = elSelecionado.tagName === 'IMG';
        
        let cColor = elSelecionado.dataset.rawBgColor || rgbToHex(compStyle.backgroundColor);
        let bgImg = elSelecionado.dataset.rawBgImage;
        
        if (bgImg === undefined) {
            let rawBg = elSelecionado.style.backgroundImage || '';
            let match = rawBg.match(/url\\(['"]?([^'"]+)['"]?\\)/);
            bgImg = match ? match[1] : '';
        }

        let aspect = elSelecionado.style.aspectRatio || '';
        let objOpacity = 1;
        
        if (isImg) { 
            objOpacity = parseFloat(compStyle.opacity); 
        } else { 
            objOpacity = parseFloat(elSelecionado.dataset.bgOpacity); 
        }
        if (isNaN(objOpacity)) objOpacity = 1;

        let tAlign = '';
        if(elSelecionado.classList.contains('text-center')) tAlign = 'text-center';
        else if(elSelecionado.classList.contains('text-right')) tAlign = 'text-right';
        else if(elSelecionado.classList.contains('text-left')) tAlign = 'text-left';

        let bAlign = '';
        if(elSelecionado.classList.contains('mx-auto') || elSelecionado.classList.contains('self-center') || elSelecionado.classList.contains('justify-center')) bAlign = 'center';
        else if(elSelecionado.classList.contains('ml-auto') || elSelecionado.classList.contains('self-end') || elSelecionado.classList.contains('justify-end')) bAlign = 'right';
        else if(elSelecionado.classList.contains('mr-auto') || elSelecionado.classList.contains('self-start') || elSelecionado.classList.contains('justify-start')) bAlign = 'left';

        let paddingX = '', paddingY = '', shadow = '', rounded = '', borderW = '';
        elSelecionado.classList.forEach(c => {
            if(c.startsWith('px-') || c === 'w-full') paddingX = c; 
            if(c === 'text-center' && elSelecionado.classList.contains('w-full')) paddingX += ' text-center';
            if(c.startsWith('py-')) paddingY = c;
            if(c.startsWith('shadow-') && !c.includes('hover:')) shadow += c + ' ';
            if(c === 'shadow') shadow += c + ' ';
            if(c.startsWith('rounded')) rounded = c;
            if(c.startsWith('border-') && !isNaN(c.split('-')[1])) borderW = c;
            if(c === 'border') borderW = c;
        });

        let href = elSelecionado.getAttribute('href') || '';
        if (!href && elSelecionado.parentElement && elSelecionado.parentElement.tagName === 'A') {
            href = elSelecionado.parentElement.getAttribute('href') || '';
        }

        window.parent.postMessage({
            type: 'ELEMENT_SELECTED',
            id: elSelecionado.id,
            tagName: elSelecionado.tagName.toLowerCase(),
            text: elSelecionado.innerText || '',
            src: elSelecionado.src || '',
            href: href,
            className: elSelecionado.className,
            bgColor: cColor,
            textColor: rgbToHex(compStyle.color),
            borderColor: rgbToHex(compStyle.borderColor),
            fontSize: parseInt(compStyle.fontSize) || 16,
            opacity: objOpacity,
            bgImage: bgImg,
            imgFormat: aspect,
            bloqueiaTexto: bloqueiaTexto,
            textAlign: tAlign,
            boxAlign: bAlign,
            paddingX: paddingX.trim(),
            paddingY: paddingY,
            shadow: shadow.trim(),
            rounded: rounded,
            borderW: borderW,
            outerHTML: elSelecionado.outerHTML
        }, '*');
    }

    window.addEventListener('message', (event) => {
        if(event.data.type === 'TOGGLE_EDIT_MODE') {
            modoEdicao = event.data.value;
            if(modoEdicao) {
                document.body.classList.add('builder-editing');
            } else {
                document.body.classList.remove('builder-editing');
                if(elSelecionado) { elSelecionado.style.outline = ''; elSelecionado.style.outlineOffset = ''; elSelecionado = null; }
                document.querySelectorAll('[data-old-outline]').forEach(el => {
                    el.style.outline = el.dataset.oldOutline || '';
                    el.style.outlineOffset = '';
                    delete el.dataset.oldOutline;
                });
                document.querySelectorAll('*').forEach(el => {
                    if (el.style.cursor === 'crosshair') el.style.cursor = '';
                });
            }
        }
        
        if (event.data.type === 'SELECT_PARENT') {
            let el = document.getElementById(event.data.id);
            if (el && el.parentElement && el.parentElement.tagName !== 'BODY') {
                selectElement(el.parentElement);
            }
        }

        if (event.data.type === 'DELETE_ELEMENT') {
            let el = document.getElementById(event.data.id);
            if(el) {
                el.remove();
                elSelecionado = null;
                sendCleanHtml();
            }
        }

        if (event.data.type === 'MOVE_UP') {
            let el = document.getElementById(event.data.id);
            if(el && el.previousElementSibling) {
                el.parentNode.insertBefore(el, el.previousElementSibling);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                sendCleanHtml();
            }
        }

        if (event.data.type === 'MOVE_DOWN') {
            let el = document.getElementById(event.data.id);
            if(el && el.nextElementSibling) {
                el.parentNode.insertBefore(el.nextElementSibling, el);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                sendCleanHtml();
            }
        }

        if (event.data.type === 'MOVE_SECTION_UP' || event.data.type === 'MOVE_SECTION_DOWN') {
            let el = document.getElementById(event.data.id);
            if(el) {
                let sec = el.closest('section, header, footer') || el;
                if(event.data.type === 'MOVE_SECTION_UP' && sec.previousElementSibling) {
                    sec.parentNode.insertBefore(sec, sec.previousElementSibling);
                    sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if(event.data.type === 'MOVE_SECTION_DOWN' && sec.nextElementSibling) {
                    sec.parentNode.insertBefore(sec.nextElementSibling, sec);
                    sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                sendCleanHtml();
            }
        }

        if (event.data.type === 'REVERSE_FLEX') {
            let el = document.getElementById(event.data.id);
            if(el) {
                let target = el.classList.contains('flex') ? el : (el.closest('.flex') || el.closest('section > div'));
                if(target) {
                    if(target.classList.contains('md:flex-row-reverse') || target.classList.contains('flex-row-reverse')) {
                        target.classList.remove('md:flex-row-reverse', 'flex-row-reverse');
                        target.classList.add('md:flex-row');
                    } else {
                        target.classList.remove('md:flex-row', 'flex-row');
                        target.classList.add('md:flex-row-reverse');
                    }
                    sendCleanHtml();
                }
            }
        }

        if (event.data.type === 'DUPLICATE_ELEMENT') {
            let el = document.getElementById(event.data.id);
            if(el) {
                let clone = el.cloneNode(true);
                clone.id = 'node_' + Math.random().toString(36).substr(2,9);
                clone.querySelectorAll('[id]').forEach(child => {
                    child.id = 'node_' + Math.random().toString(36).substr(2,9);
                });
                clone.style.outline = '';
                clone.style.outlineOffset = '';
                
                el.parentNode.insertBefore(clone, el.nextSibling);
                sendCleanHtml();
            }
        }

        if (event.data.type === 'ADD_ELEMENT') {
            let el = document.getElementById(event.data.id);
            if(el) {
                let newHtml = '';
                let newId = 'node_' + Math.random().toString(36).substr(2,9);
                
                if(event.data.elementType === 'image') {
                    newHtml = \`<img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=800&q=80" alt="Profissional realista" class="w-full max-w-md h-auto rounded-lg object-cover my-4 shadow-sm" id="\${newId}">\`;
                } else if(event.data.elementType === 'text') {
                    newHtml = \`<p class="text-slate-600 mb-4 text-base leading-relaxed" id="\${newId}">Novo parágrafo de texto editável para o seu slide.</p>\`;
                } else if(event.data.elementType === 'button') {
                    newHtml = \`<a href="#" class="inline-block px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors my-4 shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1" id="\${newId}">Clique Aqui</a>\`;
                }
                
                let isContainer = ['SECTION', 'DIV', 'HEADER', 'FOOTER', 'ARTICLE', 'NAV'].includes(el.tagName);
                
                if (isContainer) {
                    el.insertAdjacentHTML('beforeend', newHtml);
                } else {
                    el.insertAdjacentHTML('afterend', newHtml);
                }
                sendCleanHtml();
            }
        }

        if (event.data.type === 'INJECT_BLOCK') {
            let el = document.getElementById(event.data.id);
            let targetEl = el ? (el.closest('section, header, footer') || el) : document.body;
            
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = event.data.html;
            let newBlock = tempDiv.firstElementChild;
            
            newBlock.querySelectorAll('*').forEach(child => {
                if(child.id) child.id = 'node_' + Math.random().toString(36).substr(2,9);
            });
            newBlock.id = 'node_' + Math.random().toString(36).substr(2,9);

            if (targetEl && targetEl !== document.body && targetEl.tagName !== 'HTML') {
                targetEl.insertAdjacentElement('afterend', newBlock);
                newBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                let wrapper = document.querySelector('.snap-y') || document.body;
                wrapper.appendChild(newBlock);
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }
            sendCleanHtml();
        }

        if (event.data.type === 'UPDATE_FONT') {
            let fontName = event.data.font;
            let linkId = 'custom-google-font';
            let fontLink = document.getElementById(linkId);
            
            if (!fontLink) {
                fontLink = document.createElement('link');
                fontLink.id = linkId;
                fontLink.rel = 'stylesheet';
                document.head.appendChild(fontLink);
            }
            
            if (fontName !== 'sans-serif') {
                fontLink.href = \`https://fonts.googleapis.com/css2?family=\${fontName.replace(/ /g, '+')}:wght@400;500;700;900&display=swap\`;
                document.body.style.fontFamily = \`'\${fontName}', sans-serif\`;
            } else {
                fontLink.href = '';
                document.body.style.fontFamily = '';
            }
            sendCleanHtml();
        }

        if(event.data.type === 'UPDATE_ELEMENT') {
            let el = document.getElementById(event.data.id);
            if(el) {
                let isImg = el.tagName === 'IMG';
                let p = event.data.device === 'mobile' ? 'max-md:' : '';
                let escP = p ? 'max-md\\\\:' : '';

                if(event.data.text !== undefined && event.data.forceTextUpdate) el.innerText = event.data.text;
                if(event.data.src !== undefined) el.src = event.data.src;
                if(event.data.textColor !== undefined) el.style.color = event.data.textColor;
                
                if(event.data.fontSize !== undefined) {
                    el.style.fontSize = ''; 
                    el.className = el.className.replace(new RegExp('\\\\b' + escP + 'text-\\\\[\\\\d+px\\\\]\\\\b', 'g'), '').trim();
                    if(event.data.fontSize) el.classList.add(p + 'text-[' + event.data.fontSize + 'px]');
                }
                
                if (event.data.href !== undefined) {
                    let parentIsA = el.parentElement && el.parentElement.tagName === 'A';
                    if (el.tagName === 'A') {
                        if (event.data.href.trim() === '') el.removeAttribute('href');
                        else el.setAttribute('href', event.data.href);
                    } else if (parentIsA) {
                        if (event.data.href.trim() === '') el.parentElement.removeAttribute('href');
                        else el.parentElement.setAttribute('href', event.data.href);
                    } else if (event.data.href.trim() !== '') {
                        let a = document.createElement('a'); a.href = event.data.href; a.className = "inline-block cursor-pointer transition-all hover:opacity-90";
                        if (el.classList.contains('w-full') || isImg) a.classList.add('w-full', 'block');
                        el.parentNode.insertBefore(a, el); a.appendChild(el);
                    }
                }

                if (event.data.bgColor !== undefined) el.dataset.rawBgColor = event.data.bgColor;
                if (event.data.bgImage !== undefined) el.dataset.rawBgImage = event.data.bgImage;
                if (event.data.opacity !== undefined) {
                    if (isImg) { el.style.opacity = event.data.opacity; } 
                    else { el.dataset.bgOpacity = event.data.opacity; el.style.opacity = ''; }
                }

                if (!isImg) {
                    let cBgColor = el.dataset.rawBgColor || rgbToHex(window.getComputedStyle(el).backgroundColor);
                    if (!cBgColor || cBgColor === '') cBgColor = '#ffffff'; 
                    let cBgImage = el.dataset.rawBgImage;
                    if (cBgImage === undefined) { let match = (el.style.backgroundImage || '').match(/url\\(['"]?([^'"]+)['"]?\\)/); cBgImage = match ? match[1] : ''; }
                    let cOpacity = parseFloat(el.dataset.bgOpacity); if (isNaN(cOpacity)) cOpacity = 1;

                    let r = 255, g = 255, b = 255;
                    if (cBgColor.startsWith('#')) {
                        let hex = cBgColor.replace('#', '');
                        if (hex.length === 3) hex = hex.split('').map(x => x+x).join('');
                        if (hex.length === 6) { r = parseInt(hex.substring(0,2), 16); g = parseInt(hex.substring(2,4), 16); b = parseInt(hex.substring(4,6), 16); }
                    }

                    let rgbaStr = \`rgba(\${r}, \${g}, \${b}, \${cOpacity})\`;
                    el.style.setProperty('--tw-bg-opacity', '1');

                    if (cBgImage && cBgImage !== 'none') {
                        el.style.backgroundColor = 'transparent';
                        el.style.backgroundImage = \`linear-gradient(\${rgbaStr}, \${rgbaStr}), url('\${cBgImage}')\`;
                        el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; el.style.backgroundRepeat = "no-repeat";
                    } else {
                        el.style.backgroundImage = "none"; el.style.backgroundColor = rgbaStr;
                    }

                    if (cOpacity < 1 && cOpacity > 0) el.classList.add('backdrop-blur-md');
                    else el.classList.remove('backdrop-blur-md');
                } else {
                    if(event.data.bgColor !== undefined) el.style.backgroundColor = event.data.bgColor;
                }

                if(event.data.paddingX !== undefined) {
                    el.className = el.className.replace(new RegExp('\\\\b' + escP + '(px-\\\\d+|px-\\\\[.*?\\\\]|w-full|text-center)\\\\b', 'g'), '').trim();
                    if(event.data.paddingX && event.data.paddingX !== 'none') { event.data.paddingX.split(' ').forEach(cls => el.classList.add(p + cls)); }
                }
                if(event.data.paddingY !== undefined) {
                    el.className = el.className.replace(new RegExp('\\\\b' + escP + '(py-\\\\d+|py-\\\\[.*?\\\\])\\\\b', 'g'), '').trim();
                    if(event.data.paddingY && event.data.paddingY !== 'none') el.classList.add(p + event.data.paddingY);
                }
                if(event.data.rounded !== undefined) {
                    el.className = el.className.replace(/\\brounded\\b|\\brounded-(sm|md|lg|xl|2xl|3xl|full|none)\\b/g, '').trim();
                    if(event.data.rounded && event.data.rounded !== 'none') el.classList.add(event.data.rounded);
                }
                if(event.data.shadow !== undefined) {
                    el.className = el.className.replace(/\\bshadow\\b|\\bshadow-(sm|md|lg|xl|2xl|none|inner)\\b|\\bshadow-[a-z]+-500\\/50\\b/g, '').trim();
                    if(event.data.shadow && event.data.shadow !== 'none') { event.data.shadow.split(' ').forEach(cls => el.classList.add(cls)); }
                }
                if(event.data.borderW !== undefined) {
                    el.className = el.className.replace(/\\bborder\\b|\\bborder-\\d+\\b/g, '').trim();
                    if(event.data.borderW && event.data.borderW !== 'none') { el.classList.add(event.data.borderW); }
                }

                if(event.data.textAlign !== undefined) {
                    el.className = el.className.replace(new RegExp('\\\\b' + escP + '(text-left|text-center|text-right|text-justify)\\\\b', 'g'), '').trim();
                    if(event.data.textAlign) el.classList.add(p + event.data.textAlign);
                }

                if(event.data.boxAlign !== undefined) {
                    el.className = el.className.replace(new RegExp('\\\\b' + escP + '(mx-auto|ml-auto|mr-auto|self-center|self-start|self-end|justify-self-center|justify-self-start|justify-self-end)\\\\b', 'g'), '').trim();
                    if(event.data.boxAlign === 'center') el.classList.add(p+'mx-auto', p+'self-center', p+'justify-self-center');
                    if(event.data.boxAlign === 'right') el.classList.add(p+'ml-auto', p+'self-end', p+'justify-self-end');
                    if(event.data.boxAlign === 'left') el.classList.add(p+'mr-auto', p+'self-start', p+'justify-self-start');
                    
                    if (window.getComputedStyle(el).display.includes('flex') || window.getComputedStyle(el).display.includes('grid')) {
                        el.className = el.className.replace(new RegExp('\\\\b' + escP + '(justify-start|justify-center|justify-end)\\\\b', 'g'), '').trim();
                        if(event.data.boxAlign === 'center') el.classList.add(p+'justify-center');
                        if(event.data.boxAlign === 'right') el.classList.add(p+'justify-end');
                        if(event.data.boxAlign === 'left') el.classList.add(p+'justify-start');
                    }
                }

                if(event.data.animationClass !== undefined) {
                    const animClasses = ['animate-pulse', 'animate-bounce', 'hover:scale-105', 'hover:-translate-y-2', 'hover:-translate-y-1', 'hover:shadow-2xl', 'hover:shadow-indigo-500/50', 'hover:rotate-3', 'transition-transform', 'transition-all', 'transition-shadow', 'duration-300'];
                    el.classList.remove(...animClasses);
                    if(event.data.animationClass) event.data.animationClass.split(' ').forEach(cls => el.classList.add(cls));
                }

                if(event.data.imgFormat !== undefined) {
                    if (event.data.imgFormat === '') {
                        el.style.aspectRatio = ''; el.style.height = ''; el.classList.remove('object-cover', 'w-full', 'h-auto');
                    } else {
                        el.className = el.className.replace(/\\bh-(full|screen|auto|min|max|fit|px|\\d+|\\[.*?\\])\\b/g, '').trim();
                        el.style.aspectRatio = event.data.imgFormat; el.style.height = 'auto'; el.classList.add('object-cover', 'w-full');
                    }
                }
                
                if(event.data.imgRounded !== undefined) {
                    const allClassesToRemove = ['rounded-none', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full', 'shadow-none', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'border-2', 'border-4', 'border-8', 'border-white', 'border-indigo-500', 'border-emerald-500', 'shadow-indigo-500/50', 'shadow-emerald-500/50', 'shadow-rose-500/50'];
                    el.classList.remove(...allClassesToRemove);
                    if (event.data.imgRounded) { event.data.imgRounded.split(' ').forEach(cls => { if (cls) el.classList.add(cls); }); }
                }

                if(event.data.imgBorder !== undefined) {
                    if (event.data.imgBorder) { el.style.borderWidth = '4px'; el.style.borderStyle = 'solid'; el.classList.add('shadow-xl');
                    } else { el.style.borderWidth = '0px'; el.classList.remove('shadow-xl'); }
                }
                if(event.data.borderColor !== undefined) el.style.borderColor = event.data.borderColor;

                sendCleanHtml();
            }
        }
        if(event.data.type === 'REPLACE_ELEMENT_HTML') {
            let el = document.getElementById(event.data.id);
            if(el) { el.outerHTML = event.data.newHtml; sendCleanHtml(); }
        }
    });

    document.addEventListener('mouseover', (e) => {
        if(!modoEdicao || e.target === document.body || e.target === document.documentElement) return;
        e.target.dataset.oldOutline = e.target.style.outline;
        e.target.style.outline = '2px solid #0ea5e9'; 
        e.target.style.outlineOffset = '-2px';
    });
    
    document.addEventListener('mouseout', (e) => {
        if(!modoEdicao || e.target === document.body || e.target === document.documentElement) return;
        if(e.target !== elSelecionado) { 
            e.target.style.outline = e.target.dataset.oldOutline || ''; 
            e.target.style.outlineOffset = '';
        }
    });

    window.addEventListener('submit', function(e) { e.preventDefault(); e.stopPropagation(); }, true);

    document.addEventListener('click', (e) => {
        let link = e.target.closest('a');
        let btn = e.target.closest('button');
        let form = e.target.closest('form');
        let summary = e.target.closest('summary');

        if (form && !summary && !btn) { e.preventDefault(); }
        
        if (modoEdicao) {
            if (summary) {
                setTimeout(() => selectElement(summary), 10);
                return; 
            }
            e.preventDefault(); 
            e.stopPropagation();
            selectElement(e.target);
            return;
        }

        if (link || btn) {
            e.preventDefault();
            e.stopPropagation();
            if(link) {
                let href = link.getAttribute('href') || '';
                if(href.startsWith('#') && href.length > 1) {
                    try { var tEl = document.querySelector(href); if (tEl) tEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(err) {}
                } else if (href && !href.startsWith('javascript:') && href !== '/' && href !== '#') {
                    let a = document.createElement('a');
                    a.href = href;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.click();
                }
            }
            return;
        }
    }, true); 
</script>`;

// BLOCOS PRONTOS FORMATADOS PARA SLIDES (16:9 SNAP CENTER)
const UI_BLOCKS = {
    faq: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-slate-50 shrink-0" id="slide-faq">
        <div class="max-w-4xl w-full mx-auto">
            <h2 class="text-4xl font-bold text-center text-slate-900 mb-4">Perguntas Frequentes</h2>
            <p class="text-center text-slate-600 mb-12 text-xl">Tire suas dúvidas e acompanhe a apresentação com clareza.</p>
            
            <div class="space-y-4 text-left">
                <details class="bg-white p-6 rounded-xl shadow-sm cursor-pointer border border-slate-100">
                    <summary class="font-bold text-slate-800 text-lg outline-none">Como funcionará a dinâmica?</summary>
                    <p class="mt-4 text-slate-600 text-lg">Explicaremos cada tópico detalhadamente com abertura para perguntas no final do bloco.</p>
                </details>
                <details class="bg-white p-6 rounded-xl shadow-sm cursor-pointer border border-slate-100">
                    <summary class="font-bold text-slate-800 text-lg outline-none">O material será disponibilizado?</summary>
                    <p class="mt-4 text-slate-600 text-lg">Sim, todos os participantes receberão os slides em PDF após a sessão.</p>
                </details>
            </div>
        </div>
    </section>`,
    
    garantia: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-white shrink-0" id="slide-garantia">
        <div class="max-w-6xl w-full mx-auto flex items-center gap-16">
            <div class="flex-1 w-full relative">
                <div class="absolute inset-0 bg-emerald-500 rounded-2xl transform rotate-3 scale-105 opacity-20"></div>
                <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?fit=crop&w=800&q=80" alt="Profissional garantindo sucesso" class="w-full h-auto rounded-2xl shadow-xl object-cover relative z-10 aspect-video" />
            </div>
            <div class="flex-1 w-full text-left">
                <h2 class="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">O Nosso Compromisso</h2>
                <p class="text-slate-600 leading-relaxed mb-4 text-xl">Transparência, execução tática e resultados comprovados em cada etapa do projeto.</p>
                <p class="text-slate-600 leading-relaxed mb-8 text-xl">Nesta apresentação, demonstraremos exatamente como a teoria se traduz em impacto financeiro direto para o seu negócio, sem letras miúdas.</p>
                <button class="inline-block px-10 py-5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:-translate-y-1 hover:bg-emerald-700 transition-all text-xl">Acompanhe os Dados</button>
            </div>
        </div>
    </section>`,

    depoimentos: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-slate-900 shrink-0" id="slide-depoimentos">
        <div class="max-w-6xl w-full mx-auto">
            <h2 class="text-4xl font-bold text-center text-white mb-4">Casos de Sucesso</h2>
            <p class="text-center text-slate-400 mb-12 text-xl">Exemplos reais da aplicação desta metodologia.</p>
            
            <div class="grid grid-cols-3 gap-8 text-left">
                <div class="bg-slate-800 p-8 rounded-2xl border border-slate-700">
                    <div class="text-yellow-400 mb-4 flex gap-1"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
                    <p class="text-slate-300 mb-4 text-lg leading-relaxed italic">"Substitua este texto pelo relato real de um case para provar a autoridade da sua apresentação em tempo real."</p>
                    <div class="flex items-center gap-4 mt-6">
                        <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=150&q=80" alt="Cliente" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
                        <div>
                            <p class="text-white font-bold text-lg mb-1">Nome do Cliente</p>
                            <p class="text-slate-400 text-sm">Empresa / Cargo</p>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-800 p-8 rounded-2xl border border-slate-700">
                    <div class="text-yellow-400 mb-4 flex gap-1"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
                    <p class="text-slate-300 mb-4 text-lg leading-relaxed italic">"Inserir os dados verídicos e as métricas de crescimento alcançadas fortalece o argumento da palestra."</p>
                    <div class="flex items-center gap-4 mt-6">
                        <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?fit=crop&w=150&q=80" alt="Cliente" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
                        <div>
                            <p class="text-white font-bold text-lg mb-1">Nome do Parceiro</p>
                            <p class="text-slate-400 text-sm">Diretor Operacional</p>
                        </div>
                    </div>
                </div>
                <div class="bg-slate-800 p-8 rounded-2xl border border-slate-700">
                    <div class="text-yellow-400 mb-4 flex gap-1"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
                    <p class="text-slate-300 mb-4 text-lg leading-relaxed italic">"Deixe que os resultados falem por si mesmos através da voz daqueles que confiaram na solução."</p>
                    <div class="flex items-center gap-4 mt-6">
                        <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?fit=crop&w=150&q=80" alt="Cliente" class="w-16 h-16 rounded-full object-cover border-2 border-slate-600" />
                        <div>
                            <p class="text-white font-bold text-lg mb-1">Líder do Setor</p>
                            <p class="text-slate-400 text-sm">Gerência de Vendas</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>`,

    precoDestaque: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-slate-50 shrink-0" id="slide-preco">
        <div class="max-w-4xl mx-auto text-center w-full">
            <h2 class="text-4xl font-bold text-slate-900 mb-4">Proposta de Valor</h2>
            <p class="text-slate-600 mb-12 text-xl">A estruturação financeira do projeto discutido.</p>
            
            <div class="bg-white rounded-3xl shadow-xl border border-indigo-100 p-12 max-w-2xl mx-auto">
                <div class="bg-indigo-100 text-indigo-700 font-black text-sm uppercase tracking-widest py-2 px-6 rounded-full inline-block mb-6">Investimento Único</div>
                <h3 class="text-3xl font-black text-slate-900 mb-4">Implementação Completa</h3>
                <p class="text-slate-500 mb-8 text-lg">Execução técnica e suporte consultivo incluso no projeto.</p>
                <div class="text-6xl font-black text-slate-900 mb-8">R$ 5.000<span class="text-xl text-slate-500 font-normal">/escopo</span></div>
                
                <ul class="text-left space-y-4 mb-10 text-slate-600 text-lg">
                    <li class="flex items-center gap-3"><i class="fas fa-check-circle text-emerald-500 text-2xl"></i> Mapeamento e Diagnóstico</li>
                    <li class="flex items-center gap-3"><i class="fas fa-check-circle text-emerald-500 text-2xl"></i> Execução Estratégica em 4 Semanas</li>
                    <li class="flex items-center gap-3"><i class="fas fa-check-circle text-emerald-500 text-2xl"></i> Relatórios de Métricas Semanais</li>
                </ul>
                
                <button class="block w-full py-5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:-translate-y-1 transition-all text-xl">Aprovar Proposta</button>
            </div>
        </div>
    </section>`,

    autorEsq: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-white shrink-0" id="slide-autor-esq">
        <div class="max-w-6xl w-full mx-auto flex items-center gap-16">
            <div class="flex-1 w-full relative">
                <div class="absolute -inset-4 bg-indigo-50 rounded-2xl transform -rotate-3 z-0"></div>
                <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?fit=crop&w=800&q=80" alt="Palestrante" class="w-full rounded-2xl shadow-xl object-cover aspect-[4/5] relative z-10 border-4 border-white" />
            </div>
            <div class="flex-1 w-full text-left relative z-10">
                <p class="text-indigo-600 font-bold uppercase tracking-widest text-lg mb-2">Quem sou eu</p>
                <h2 class="text-5xl font-black text-slate-900 mb-6">Apresentação do Autor</h2>
                <p class="text-slate-600 mb-4 text-2xl leading-relaxed">Concentre toda a narrativa biográfica neste primeiro slide. Fale sobre quem você é, sua experiência de mercado e as credenciais que validam o conteúdo que será exposto.</p>
                <p class="text-slate-600 text-xl leading-relaxed">Este slide estabelece a autoridade necessária para que a audiência preste atenção nos próximos dados da apresentação.</p>
            </div>
        </div>
    </section>`,

    autorDir: `
    <section class="w-full h-screen flex flex-col justify-center items-center p-12 snap-center bg-white shrink-0" id="slide-autor-dir">
        <div class="max-w-6xl w-full mx-auto flex flex-row-reverse items-center gap-16">
            <div class="flex-1 w-full relative">
                <div class="absolute -inset-4 bg-indigo-50 rounded-2xl transform rotate-3 z-0"></div>
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=800&q=80" alt="Palestrante" class="w-full rounded-2xl shadow-xl object-cover aspect-[4/5] relative z-10 border-4 border-white" />
            </div>
            <div class="flex-1 w-full text-left relative z-10">
                <p class="text-indigo-600 font-bold uppercase tracking-widest text-lg mb-2">Quem sou eu</p>
                <h2 class="text-5xl font-black text-slate-900 mb-6">Apresentação do Autor</h2>
                <p class="text-slate-600 mb-4 text-2xl leading-relaxed">Concentre toda a narrativa biográfica neste primeiro slide. Fale sobre quem você é, sua experiência de mercado e as credenciais que validam o conteúdo que será exposto.</p>
                <p class="text-slate-600 text-xl leading-relaxed">Este slide estabelece a autoridade necessária para que a audiência preste atenção nos próximos dados da apresentação.</p>
            </div>
        </div>
    </section>`
};

export default function Home() {
  const [modalMeusSitesAberto, setModalMeusSitesAberto] = useState(false);
  const [listaSites, setListaSites] = useState<any[]>([]);
  const [carregandoSites, setCarregandoSites] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const SITES_POR_PAGINA = 6; 

  const [siteEditando, setSiteEditando] = useState<{id: string, slug: string, titulo: string} | null>(null);
  const [corSelecionada, setCorSelecionada] = useState('auto');
  const [uploadedImages, setUploadedImages] = useState<{ mimeType: string; data: string }[]>([]);
  const [historicoCodigo, setHistoricoCodigo] = useState<string[]>([]);
  
  const [abaAtiva, setAbaAtiva] = useState<'gerar' | 'blocos'>('gerar');
  const [aiSearchType, setAiSearchType] = useState('realista');
  
  const [modoInspetor, setModoInspetor] = useState(false);
  const [elementoSelecionado, setElementoSelecionado] = useState<any>(null);
  const [statusApis, setStatusApis] = useState<{ texto: string; processing: boolean }>({ texto: 'Aguardando Operação', processing: false });

  const [modalImportarCodigo, setModalImportarCodigo] = useState(false);
  const [codigoExterno, setCodigoExterno] = useState('');

  const [deviceView, setDeviceView] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [modalSEO, setModalSEO] = useState(false);
  const [seoData, setSeoData] = useState({ title: 'Apresentação Profissional', description: 'Slides da apresentação', headScripts: '', bodyScripts: '' });

  const [nichoEstilo, setNichoEstilo] = useState('minimalista');
  const [productContent, setProductContent] = useState('');

  const purificarHTML = (rawHtml: string) => {
      let clean = rawHtml.replace(/<script id="editor-magic-script">[\s\S]*?<\/script>/gi, '');
      clean = clean.replace(/<style id="builder-core-styles">[\s\S]*?<\/style>/gi, '');
      clean = clean.replace(/\bbuilder-editing\b/gi, '');
      clean = clean.replace(/cursor:\s*crosshair;?/gi, '')
                   .replace(/outline:\s*2px solid rgb\(14, 165, 233\);?/gi, '')
                   .replace(/outline:\s*3px solid rgb\(79, 70, 229\);?/gi, '')
                   .replace(/outline-offset:\s*-[234]px;?/gi, '')
                   .replace(/data-old-outline="[^"]*"/gi, '')
                   .replace(/\s*style="\s*"/gi, ''); 
      clean = clean.replace(/ class="\s*"/gi, ''); 
      return clean;
  };

  useEffect(() => {
    const verificarSessao = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = '/login'; }
    };
    verificarSessao();

    const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'ELEMENT_SELECTED') setElementoSelecionado(e.data);
        if (e.data.type === 'HTML_SYNC') {
            const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
            if (codEl) {
                const htmlLimpo = purificarHTML(e.data.html);
                setHistoricoCodigo(prev => {
                    if (prev.length > 0 && prev[prev.length - 1] === htmlLimpo) return prev;
                    return [...prev, codEl.value]; 
                });
                codEl.value = htmlLimpo; 
            }
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const toggleInspetor = () => {
      const newMode = !modoInspetor;
      setModoInspetor(newMode);
      setElementoSelecionado(null);
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      if(iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'TOGGLE_EDIT_MODE', value: newMode }, '*');
  };

  const atualizarElemento = (field: string, value: string | number | boolean, forceTextUpdate = false) => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'UPDATE_ELEMENT', id: elementoSelecionado.id, [field]: value, forceTextUpdate, device: deviceView }, '*');
      setElementoSelecionado((prev: any) => ({...prev, [field]: value}));
  };

  const deletarElementoSelecionado = () => {
      if(!elementoSelecionado) return;
      if(!confirm('Tem certeza que deseja excluir este elemento do slide?')) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'DELETE_ELEMENT', id: elementoSelecionado.id }, '*');
      setElementoSelecionado(null);
  };

  const duplicarElementoSelecionado = () => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'DUPLICATE_ELEMENT', id: elementoSelecionado.id }, '*');
      (window as any).showNotification("Elemento duplicado com sucesso!", "success");
  };

  const adicionarNovoElemento = (tipo: string) => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'ADD_ELEMENT', id: elementoSelecionado.id, elementType: tipo }, '*');
      (window as any).showNotification("Novo elemento inserido!", "success");
  };

  const moverElemento = (direcao: 'UP' | 'DOWN') => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: direcao === 'UP' ? 'MOVE_UP' : 'MOVE_DOWN', id: elementoSelecionado.id }, '*');
  };

  const moverSecaoInteira = (direcao: 'UP' | 'DOWN') => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: direcao === 'UP' ? 'MOVE_SECTION_UP' : 'MOVE_SECTION_DOWN', id: elementoSelecionado.id }, '*');
      (window as any).showNotification(direcao === 'UP' ? "Slide movido para cima!" : "Slide movido para baixo!", "success");
  };

  const inverterLayoutBox = () => {
      if(!elementoSelecionado) return;
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'REVERSE_FLEX', id: elementoSelecionado.id }, '*');
  };

  const injetarBlocoPronto = (tipo: keyof typeof UI_BLOCKS) => {
      const htmlBloco = UI_BLOCKS[tipo];
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'INJECT_BLOCK', id: elementoSelecionado?.id, html: htmlBloco }, '*');
      (window as any).showNotification("Slide inserido com sucesso!", "success");
  };

  const aplicarFonte = (fonte: string) => {
      setFontFamily(fonte);
      const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
      iframe.contentWindow?.postMessage({ type: 'UPDATE_FONT', font: fonte }, '*');
  };

  const salvarConfiguracoesSEO = () => {
      const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
      if(codEl) {
          let htmlAtual = codEl.value;
          
          if(htmlAtual.includes('<title>')) {
              htmlAtual = htmlAtual.replace(/<title>.*<\/title>/gi, `<title>${seoData.title}</title>`);
          } else {
              htmlAtual = htmlAtual.replace('<head>', `<head>\n    <title>${seoData.title}</title>`);
          }

          if(htmlAtual.includes('name="description"')) {
              htmlAtual = htmlAtual.replace(/<meta name="description"[^>]+>/gi, `<meta name="description" content="${seoData.description}">`);
          } else {
              htmlAtual = htmlAtual.replace('<head>', `<head>\n    <meta name="description" content="${seoData.description}">`);
          }

          htmlAtual = htmlAtual.replace(/<!-- INJECT_HEAD -->[\s\S]*?<!-- END_HEAD -->/gi, '');
          htmlAtual = htmlAtual.replace(/<!-- INJECT_BODY -->[\s\S]*?<!-- END_BODY -->/gi, '');

          if(seoData.headScripts.trim()) {
              htmlAtual = htmlAtual.replace('</head>', `<!-- INJECT_HEAD -->\n${seoData.headScripts}\n<!-- END_HEAD -->\n</head>`);
          }
          if(seoData.bodyScripts.trim()) {
              htmlAtual = htmlAtual.replace('</body>', `<!-- INJECT_BODY -->\n${seoData.bodyScripts}\n<!-- END_BODY -->\n</body>`);
          }

          codEl.value = htmlAtual;
          const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
          if (iframe) iframe.srcdoc = htmlAtual + SCRIPT_PREVIEW;
      }
      setModalSEO(false);
      (window as any).showNotification("Configurações salvas!", "success");
  };

  const desfazerCodigo = () => {
    if (historicoCodigo.length === 0) {
        (window as any).showNotification("Nenhuma alteração para desfazer.", "error");
        return;
    }
    const novoHistorico = [...historicoCodigo];
    const estadoAnterior = novoHistorico.pop();
    setHistoricoCodigo(novoHistorico);
    const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
    const prevEl = document.getElementById('previewFrame') as HTMLIFrameElement;
    if (codEl) codEl.value = estadoAnterior || '';
    if (prevEl) prevEl.srcdoc = (estadoAnterior || '') + SCRIPT_PREVIEW; 
    setElementoSelecionado(null);
    (window as any).showNotification("Ação desfeita com sucesso.", "success");
  };

  const injetarCodigoExterno = () => {
    if(!codigoExterno.trim()) return;
    let htmlFinal = codigoExterno;
    htmlFinal = htmlFinal.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    htmlFinal = htmlFinal.replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, '');
    htmlFinal = htmlFinal.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '<div class="p-8 my-4 bg-slate-100 border-2 border-dashed border-slate-400 text-center text-slate-500 font-bold rounded-lg flex flex-col items-center justify-center"><i class="fas fa-ban text-2xl mb-2 text-slate-400"></i><span>Iframe Externo Removido</span><span class="text-[10px] font-normal mt-1">Bloqueio de segurança.</span></div>');

    if(!htmlFinal.toLowerCase().includes('<body')) {
        htmlFinal = `<!DOCTYPE html>
<html lang="pt-BR" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <title>${seoData.title}</title>
</head>
<body class="antialiased text-slate-800 bg-slate-900" style="font-family: '${fontFamily}', sans-serif;">
    <div class="h-screen w-full overflow-y-scroll snap-y snap-mandatory scroll-smooth">
        ${htmlFinal}
    </div>
</body>
</html>`;
    } else {
        if(htmlFinal.includes('</head>')) {
            htmlFinal = htmlFinal.replace('</head>', '<script src="https://cdn.tailwindcss.com"></script>\n<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">\n</head>');
        } else if(htmlFinal.includes('<body')) {
            htmlFinal = htmlFinal.replace('<body', '<head><script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></head><body class="bg-slate-900"');
        }
    }

    const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
    const prevEl = document.getElementById('previewFrame') as HTMLIFrameElement;
    if (codEl) { setHistoricoCodigo(prev => [...prev, codEl.value]); codEl.value = htmlFinal; }
    if (prevEl) prevEl.srcdoc = htmlFinal + SCRIPT_PREVIEW; 
    setCodigoExterno(''); setModalImportarCodigo(false);
    (window as any).showNotification("Apresentação importada!", "success");
    if((window as any).mudarSeparador) (window as any).mudarSeparador('preview');
  };

  const otimizarComIA = async (comandoOverride?: string) => {
      const promptInput = document.getElementById('ai_prompt_element') as HTMLInputElement;
      const comando = comandoOverride || promptInput?.value.trim();
      if(!comando || !elementoSelecionado) { (window as any).showNotification("Informe a instrução de otimização.", "error"); return; }
      const systemInstruction = `Atue como Especialista de Apresentações (Slides). Você receberá o HTML de UM elemento do slide. Aplique a seguinte modificação: "${comando}". 
      REGRA MÁXIMA: DEVOLVA APENAS A TAG HTML FINAL E PRONTA PARA USO. Preserve obrigatoriamente o ID original id="${elementoSelecionado.id}".`;
      const resData = await chamarMotorIA(systemInstruction, [{text: `CÓDIGO ORIGINAL:\n${elementoSelecionado.outerHTML}`}], true);
      if(resData && resData.html) {
          const cleanHtml = resData.html.replace(/```html/gi, '').replace(/```/g, '').trim();
          const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
          iframe.contentWindow?.postMessage({ type: 'REPLACE_ELEMENT_HTML', id: elementoSelecionado.id, newHtml: cleanHtml }, '*');
          if(promptInput) promptInput.value = '';
          (window as any).showNotification("Slide atualizado com IA.", "success");
      }
  };

  const executarRefinamentoGlobal = async () => {
    const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
    const currentHtml = codEl?.value || '';
    if (!currentHtml || currentHtml.length < 100) { (window as any).showNotification("Você precisa ter uma apresentação gerada para poder modificá-la estruturalmente.", "error"); return; }
    const promptInput = document.getElementById('refineGlobalContent') as HTMLTextAreaElement;
    const comando = promptInput?.value.trim();
    if (!comando) { (window as any).showNotification("Descreva o que deseja alterar nos slides.", "error"); return; }
    setStatusApis({ texto: 'Modificando Apresentação...', processing: true });
    try {
        const response = await fetch('/api/gerar', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemInstruction: "Engenheiro Sênior de Apresentações em HTML. Modifique os slides conforme solicitado mantendo o formato snap-scroll.", promptParts: [{ text: `COMANDO DO USUÁRIO:\n${comando}\n\n=== CÓDIGO HTML DOS SLIDES ATUAIS ===\n${currentHtml}` }], isSiteRefinement: true, isGeminiForced: true })
        });
        const responseText = await response.text();
        let data;
        try { data = JSON.parse(responseText); } catch (e) { throw new Error("Ocorreu um erro no servidor de IA."); }
        if (!data.success) throw new Error(data.error);
        if (data.html && data.html.length > 50) {
            processarRespostaDOM(data); promptInput.value = ''; (window as any).showNotification("Alteração Global aplicada com sucesso!", "success");
        } else { throw new Error("A IA falhou ao processar a modificação global."); }
    } catch (err: any) { (window as any).showNotification(err.message || "Erro na modificação.", "error"); } finally { setStatusApis({ texto: 'Aguardando Operação', processing: false }); }
  };

  const chamarMotorIA = async (systemInstructionText: string, promptParts: any[], isElementRefinement = false) => {
    setStatusApis({ texto: isElementRefinement ? 'A IA está reescrevendo o slide...' : 'A IA está estruturando a Apresentação...', processing: true });
    try {
      const dinamicaStyle = (document.getElementById('dinamicaSite') as HTMLSelectElement)?.value || 'estatico';
      const response = await fetch('/api/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: systemInstructionText, promptParts, imageStyle: 'real', dinamica: dinamicaStyle, isElementRefinement, isGeminiForced: !isElementRefinement }) });
      const responseText = await response.text();
      let data;
      try { data = JSON.parse(responseText); } catch (err) { throw new Error("Houve um gargalo na comunicação com a IA."); }
      if (!data.success) throw new Error(data.error === 'RATE_LIMIT_EXCEEDED' ? "Limite de acessos da IA atingido. Aguarde 60 segundos." : data.error);
      return data;
    } catch (err: any) {
      let errorMsg = err.message;
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.includes('RATE_LIMIT')) { errorMsg = "Servidor ocupado. Aguarde um minuto."; }
      (window as any).showNotification(errorMsg, 'error'); return null;
    } finally { setStatusApis({ texto: 'Aguardando Ação', processing: false }); }
  };

  const getMegaPromptEstilo = () => {
    const estilo = nichoEstilo;
    if (estilo === 'premium') return "DIRETRIZ DE DESIGN DO SLIDE: Crie uma aparência sofisticada e de alto padrão (Premium). Use fontes serifadas elegantes e simetria perfeita na tela.";
    if (estilo === 'terapia') return "DIRETRIZ DE DESIGN DO SLIDE: Crie uma aparência calma, leve (Saúde mental). Use muito espaço em branco, bordas suaves e cores que transmitem paz.";
    if (estilo === 'agressivo') return "DIRETRIZ DE DESIGN DO SLIDE: Foco total em Conversão e Vendas de Palco. Use alto contraste, cores fortes e dados diretos ao ponto.";
    return "DIRETRIZ DE DESIGN DO SLIDE: Apresentação limpa, moderna e altamente profissional.";
  };

  const getMegaPromptCores = () => {
    const cor = corSelecionada;
    if (cor === 'personalizada') return `CORES DO SLIDE: Use ${(document.getElementById('corFundo') as HTMLInputElement)?.value} como fundo principal e ${(document.getElementById('corPrimaria') as HTMLInputElement)?.value} para detalhes.`;
    if (cor === 'auto') return "CORES DO SLIDE: Copie fielmente as cores da imagem que o usuário anexou para criar os slides.";
    const mapaCores:any = { 'dark': 'Modo Escuro Profundo', 'azul': 'Tons de Azul Acadêmico', 'verde': 'Tons de Verde Corporativo', 'roxo': 'Tons de Roxo Criativo', 'terracota': 'Tons Terrosos', 'rosa': 'Tons de Rosa Suave', 'vermelho': 'Vermelho Alerta', 'amarelo': 'Amarelo Energia', 'laranja': 'Laranja Criativo', 'cinza': 'Cinza Monocromático' };
    return `CORES DA APRESENTAÇÃO: A paleta de cores dos slides deve ser baseada em: ${mapaCores[cor] || 'Cores neutras'}.`;
  };

  const executarGeracaoSiteHibrida = async () => {
    const content = productContent.trim();
    if (uploadedImages.length === 0 && !content) { (window as any).showNotification('Anexe uma imagem OU digite o tema/conteúdo da apresentação.', 'error'); return; }
    
    let promptParts: any[] = [];
    let commandText = "Gere uma Apresentação de Slides completa (Pitch Deck ou Aula). O espaçamento deve ter uma linha exata entre os títulos dos tópicos e os parágrafos (utilize mb-4). Utilize APENAS imagens fotográficas humanas realistas (exclua absolutamente todos os desenhos, gráficos animados e elementos sci-fi). Qualquer narrativa biográfica ou história pessoal deve ser consolidada estritamente no primeiro slide.\n\n";
    
    if (content) { commandText += `CONTEÚDO DA APRESENTAÇÃO:\n"""\n${content}\n"""\n\n`; }
    if (uploadedImages.length > 0) {
        commandText += `Use a IMAGEM ANEXADA como base rigorosa para extrair a estrutura visual e paleta de cores.`;
        uploadedImages.forEach(img => promptParts.push({ inlineData: { mimeType: img.mimeType, data: img.data } }));
    }
    promptParts.unshift({ text: commandText });
    
    const basePrompt = `Como Especialista Sênior em Apresentações, crie a estrutura completa em HTML de uma apresentação impecável. Envolva todo o conteúdo em uma div principal com as classes 'h-screen w-full overflow-y-scroll snap-y snap-mandatory bg-slate-900 scroll-smooth'. 
    Dentro desta div, crie múltiplas tags <section> sequenciais (Slide 1, Slide 2, etc). 
    Cada <section> representa um único slide e DEVE possuir estritamente as classes Tailwind: 'w-full min-h-screen flex flex-col justify-center items-center p-12 snap-center shrink-0 relative'. 
    A apresentação deve conter Slide de Capa, Problema, Solução, Benefícios, Casos de Sucesso e Chamada de Encerramento. Use tipografia super grande para leitura à distância em tela.`;
    
    const instrucoesFinais = `${basePrompt} \n${getMegaPromptEstilo()} \n${getMegaPromptCores()}`;
    const data = await chamarMotorIA(instrucoesFinais, promptParts, false);
    
    if (data && data.html) {
        let hHtml = data.html;
        if(fontFamily !== 'sans-serif') {
            hHtml = hHtml.replace('</head>', `<link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;700;900&display=swap" rel="stylesheet">\n</head>`);
            // Se tiver body com outras fontes, injetamos a escolhida
            hHtml = hHtml.replace(/<body[^>]*>/i, (match) => {
                return match.replace(/style="[^"]*"/i, '') + ` style="font-family: '${fontFamily}', sans-serif;"`;
            });
        }
        data.html = hHtml;
        processarRespostaDOM(data);
    }
  };

  function processarRespostaDOM(data: any) {
      const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
      const prevEl = document.getElementById('previewFrame') as HTMLIFrameElement;
      if (codEl) { setHistoricoCodigo(prev => [...prev, codEl.value]); codEl.value = purificarHTML(data.html); }
      if (prevEl) prevEl.srcdoc = purificarHTML(data.html) + SCRIPT_PREVIEW; 
      (window as any).showNotification(`Apresentação Criada com Sucesso!`, 'success');
      if (modoInspetor) toggleInspetor(); 
  }

  const handleUploadImgElem = (e: React.ChangeEvent<HTMLInputElement>, isBg = false) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev: any) => { atualizarElemento(isBg ? 'bgImage' : 'src', ev.target.result); };
      reader.readAsDataURL(file);
      e.target.value = ''; 
  };

  const gerarNovaImagemIAAutomatica = async (isBackground = false, overrideFormat?: string) => {
      if(!elementoSelecionado) return;
      (window as any).showNotification("A IA está buscando a foto ideal na Unsplash...", "success");
      
      let formatToUse = overrideFormat !== undefined ? overrideFormat : (elementoSelecionado.imgFormat || '');
      let orientation = 'landscape'; let w = 1280, h = 720;
      if (formatToUse === '3/4' || formatToUse === 'aspect-[3/4]') { orientation = 'portrait'; w = 800; h = 1200; }
      else if (formatToUse === '1/1' || formatToUse === 'aspect-square') { orientation = 'squarish'; w = 800; h = 800; }
      
      let termoContexto = elementoSelecionado.text || productContent || "presentation business";
      if (termoContexto.length > 200) termoContexto = termoContexto.substring(0, 200);

      let contextModifier = "realistic photography, candid, natural";
      if(aiSearchType === 'cinematografica') contextModifier = "cinematic lighting, dramatic, high quality photography";
      if(aiSearchType === 'estudio') contextModifier = "studio lighting, professional portrait, editorial photography";
      if(aiSearchType === 'minimalista') contextModifier = "minimalist, clean, simple, photography";

      try {
          const jsonPrompt = `Resuma o seguinte texto em apenas 2 palavras em INGLÊS que sirvam como termo de busca para o Unsplash focada em ${contextModifier}. Texto: "${termoContexto}". Devolva APENAS o JSON EXATO: {"keyword": "palavra1,palavra2"}`;
          const iaRes = await fetch('/api/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: "Especialista Unsplash.", promptParts: [{text: jsonPrompt}], isElementRefinement: true, isGeminiForced: false }) });
          const iaData = await iaRes.json();
          let keywordFinal = "professional business";
          if(iaData && iaData.html) {
              try { const kwJson = JSON.parse(iaData.html.replace(/```json/gi, '').replace(/```/g, '').trim()); if (kwJson.keyword) keywordFinal = kwJson.keyword; } catch(e) {}
          }
          const res = await fetch(`/api/unsplash?q=${encodeURIComponent(keywordFinal)}&orientation=${orientation}`);
          const data = await res.json();
          if(data && data.url) { atualizarElemento(isBackground ? 'bgImage' : 'src', data.url); (window as any).showNotification("Foto aplicada!", "success"); 
          } else { throw new Error("API não retornou foto"); }
      } catch(err) { 
          const fallback = `https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?fit=crop&w=${w}&q=80`; 
          atualizarElemento(isBackground ? 'bgImage' : 'src', fallback); (window as any).showNotification("Usando imagem padrão por limite de cota.", "error"); 
      }
  };

  const carregarMeusSites = async () => {
    setCarregandoSites(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data, error } = await supabase.from('apresentacoes_salvas').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (!error) { setListaSites(data || []); setPaginaAtual(1); }
    setCarregandoSites(false);
    setModalMeusSitesAberto(true);
  };

  const deletarSite = async (id: string, slug: string) => {
    if (!confirm(`Deseja excluir esta apresentação para sempre?`)) return;
    await supabase.from('apresentacoes_salvas').delete().eq('id', id);
    setListaSites(listaSites.filter(site => site.id !== id));
    if (siteEditando?.id === id) setSiteEditando(null);
  };

  const editarSite = (site: any) => {
    const codEl = document.getElementById('codigoGerado') as HTMLTextAreaElement;
    const prevEl = document.getElementById('previewFrame') as HTMLIFrameElement;
    if (codEl) codEl.value = site.html_content;
    if (prevEl) prevEl.srcdoc = site.html_content + SCRIPT_PREVIEW; 
    setSiteEditando({ id: site.id, slug: site.slug, titulo: site.titulo });
    setModalMeusSitesAberto(false);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { (window as any).showNotification('Por favor, envie apenas arquivos de imagem.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width; let h = img.height; const maxDim = 1400; 
            if (w > maxDim || h > maxDim) { if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; } else { w = Math.round((w * maxDim) / h); h = maxDim; } }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, w, h); const dataUrl = canvas.toDataURL('image/jpeg', 0.8); const base64Data = dataUrl.split(',')[1]; setUploadedImages(prev => [...prev, { mimeType: 'image/jpeg', data: base64Data }]); }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUploadInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { Array.from(e.target.files).forEach(file => processFile(file as File)); e.target.value = ''; }
  };

  const removerImagem = (index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      for (let i = 0; i < items.length; i++) { if (items[i].kind === 'file' && items[i].type.startsWith('image/')) processFile(items[i].getAsFile()!); }
    };
    document.body.addEventListener('paste', handlePaste);
    return () => document.body.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    (window as any).mudarSeparador = (aba: string) => {
      document.getElementById('previewFrame')!.classList.toggle('active', aba === 'preview');
      document.getElementById('codigoContainer')!.classList.toggle('active', aba === 'code');
      document.getElementById('tabPreview')!.className = aba === 'preview' ? "px-5 py-2 rounded-md font-bold text-[11px] bg-slate-800 text-white shadow-sm transition" : "px-5 py-2 rounded-md font-bold text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition";
      document.getElementById('tabCode')!.className = aba === 'code' ? "px-5 py-2 rounded-md font-bold text-[11px] bg-slate-800 text-white shadow-sm transition" : "px-5 py-2 rounded-md font-bold text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition";
    };

    (window as any).showNotification = (msg: string, type: string) => {
      const exist = document.getElementById('custom-toast'); if(exist) exist.remove();
      const div = document.createElement('div'); div.id = 'custom-toast';
      div.className = type === 'error' 
      ? `fixed top-6 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-xl shadow-xl z-[9999] flex items-start gap-3 text-sm font-semibold max-w-lg w-full break-words` 
      : `fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-4 rounded-xl shadow-xl z-[9999] flex items-center gap-3 text-sm font-semibold`;
      div.innerHTML = type === 'error' 
      ? `<i class="fas fa-exclamation-circle text-red-500 mt-0.5 text-lg shrink-0"></i> <span class="flex-1">${msg}</span>` 
      : `<i class="fas fa-check-circle text-emerald-400 text-lg shrink-0"></i> <span>${msg}</span>`;
      document.body.appendChild(div);
      setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.4s'; setTimeout(() => div.remove(), 4000); }, 4000);
    };

    (window as any).copiarCodigo = () => {
      const txt = (document.getElementById('codigoGerado') as HTMLTextAreaElement)?.value;
      if (!txt) return; navigator.clipboard.writeText(txt); (window as any).showNotification('O Código HTML copiado para área de transferência.', 'success');
    };

    (window as any).baixarHtmlGerado = () => {
      const txt = (document.getElementById('codigoGerado') as HTMLTextAreaElement)?.value;
      if (!txt) return;
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'text/html' }));
      a.download = siteEditando ? `${siteEditando.slug}.html` : 'meus-slides.html'; a.click();
    };

    (window as any).baixarPDF = () => {
        const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print(); // O print em A4 landscape simula perfeitamente o PDF de slides.
        } else {
            (window as any).showNotification('Gere a apresentação primeiro.', 'error');
        }
    };

    (window as any).baixarPPTX = () => {
        (window as any).showNotification('A exportação direta para PowerPoint (.pptx) requer integração com pptxgenjs. Esta funcionalidade será ativada no backend da Versão 2.', 'success');
    };

    (window as any).handlePublicarSite = async () => {
      const htmlContent = (document.getElementById('codigoGerado') as HTMLTextAreaElement)?.value;
      if (!htmlContent) { (window as any).showNotification('Você precisa criar a apresentação primeiro.', 'error'); return; }
      let cleanHtml = purificarHTML(htmlContent);
      if (siteEditando) { await supabase.from('apresentacoes_salvas').update({ html_content: cleanHtml }).eq('id', siteEditando.id); (window as any).showNotification('Apresentação atualizada com sucesso!', 'success'); return; }
      const nome = prompt('Qual será o nome da sua Apresentação? (Vai aparecer no Link Público):'); if (!nome) return; 
      let slug = nome.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || nanoid(6); 
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('Sua conta desconectou. Entre novamente.'); return; }
      await supabase.from('apresentacoes_salvas').insert([{ user_id: session?.user.id, slug, titulo: nome, html_content: cleanHtml }]);
      navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
      alert(`Parabéns! Sua Apresentação já tem um link público online.\nLink copiado:\n${window.location.origin}/${slug}`);
    };
  }, [siteEditando]); 

  const indexOfLastSite = paginaAtual * SITES_POR_PAGINA;
  const indexOfFirstSite = indexOfLastSite - SITES_POR_PAGINA;
  const sitesAtuais = listaSites.slice(indexOfFirstSite, indexOfLastSite);
  const totalPaginas = Math.ceil(listaSites.length / SITES_POR_PAGINA);

  return (
    <div className="h-screen overflow-hidden flex relative bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style dangerouslySetInnerHTML={{__html: `
        .input-standard { width: 100%; padding: 0.6rem 0.8rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; background-color: #f8fafc; font-size: 0.75rem; outline: none; color: #334155; transition: all 0.2s; font-weight: 500;}
        .input-standard:focus { border-color: #6366f1; background-color: #ffffff; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .input-label { font-size: 0.65rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.4rem; display: block; }
        .panel-section { padding: 1.2rem; border-bottom: 1px solid #f1f5f9; }
        
        #previewFrame, #codigoContainer { display: none; }
        #previewFrame.active, #codigoContainer.active { display: block; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px;}
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        details > summary { list-style: none; }
        details > summary::-webkit-details-marker { display: none; }

        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: landscape; margin: 0; }
        }
      `}} />

      {/* MODAIS (SEO E IMPORTAÇÃO) */}
      {modalImportarCodigo && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-200">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="text-lg font-black text-slate-800"><i className="fas fa-code text-indigo-500 mr-2"></i> Importar HTML Existente</h2>
                      <button onClick={() => setModalImportarCodigo(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition font-bold"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="p-6 bg-slate-50">
                      <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                          Cole o código da sua apresentação (Tailwind CSS). O sistema formatará perfeitamente para o palco 16:9 de edição visual.
                      </p>
                      <textarea 
                          value={codigoExterno} 
                          onChange={(e) => setCodigoExterno(e.target.value)} 
                          className="w-full h-64 p-4 font-mono text-[13px] bg-[#0d1117] text-[#56d364] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 custom-scrollbar"
                          placeholder="<!-- Cole o código HTML dos slides aqui... -->"
                      ></textarea>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
                      <button onClick={() => setModalImportarCodigo(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-lg transition">Cancelar</button>
                      <button onClick={injetarCodigoExterno} disabled={!codigoExterno.trim()} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-lg transition shadow-md flex items-center gap-2 disabled:opacity-50"><i className="fas fa-magic"></i> Importar Slides</button>
                  </div>
              </div>
          </div>
      )}

      {modalSEO && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl border border-slate-200">
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h2 className="text-lg font-black text-slate-800"><i className="fas fa-search-dollar text-indigo-500 mr-2"></i> Configurações da Apresentação</h2>
                      <button onClick={() => setModalSEO(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition font-bold shadow-sm"><i className="fas fa-times"></i></button>
                  </div>
                  <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
                      <div className="space-y-4">
                          <div>
                              <label className="input-label">Título da Apresentação (Aba do Navegador)</label>
                              <input type="text" value={seoData.title} onChange={e => setSeoData({...seoData, title: e.target.value})} className="input-standard text-sm font-bold" placeholder="Ex: Pitch Deck Comercial Q4" />
                          </div>
                          <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl mt-4">
                              <label className="input-label text-orange-800"><i className="fas fa-code text-orange-500 mr-1"></i> Scripts do Cabeçalho (Rastreio)</label>
                              <textarea rows={3} value={seoData.headScripts} onChange={e => setSeoData({...seoData, headScripts: e.target.value})} className="w-full p-3 font-mono text-[11px] bg-white border border-orange-300 rounded-lg outline-none custom-scrollbar" placeholder="<!-- Ex: Meta Pixel, Tag Analytics -->"></textarea>
                          </div>
                      </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
                      <button onClick={salvarConfiguracoesSEO} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg transition-all hover:-translate-y-0.5"><i className="fas fa-save mr-2"></i> Salvar</button>
                  </div>
              </div>
          </div>
      )}

      {/* OVERLAY DE CARREGAMENTO AMIGÁVEL */}
      {statusApis.processing && (
          <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center">
              <div className="w-14 h-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-5"></div>
              <p className="text-slate-800 font-black text-xl tracking-tight mb-2">{statusApis.texto}</p>
              <p className="text-slate-500 font-medium text-sm">Estruturando os slides com IA. Isso pode levar alguns segundos...</p>
          </div>
      )}

      {/* PAINEL LATERAL ESQUERDO */}
      <div className="w-[360px] bg-white border-r border-slate-200 flex flex-col h-full z-10 flex-shrink-0 shadow-sm">
          
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h1 className="text-xl font-black tracking-tight text-slate-800 flex items-center">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center mr-2.5 text-white shadow-md shadow-indigo-200"><i className="fas fa-presentation text-xs"></i></div>
                  Slide<span className="text-indigo-600">Pro</span>
              </h1>
              
              <button onClick={toggleInspetor} className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${modoInspetor ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                  <i className={`fas fa-crosshairs ${modoInspetor ? 'animate-pulse text-yellow-300' : ''}`}></i> {modoInspetor ? 'Editando...' : 'Editar Slide'}
              </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              
              {modoInspetor ? (
                  <div className="animate-[fadeIn_0.2s_ease]">
                      <div className="bg-indigo-600 text-white p-4 text-[11px] font-black tracking-widest uppercase flex justify-between items-center shadow-inner">
                          <span>Editor de Elementos</span>
                          <i className="fas fa-paint-brush text-indigo-300"></i>
                      </div>

                      {!elementoSelecionado ? (
                          <div className="flex flex-col items-center justify-center p-14 text-center text-slate-400">
                              <div className="w-16 h-16 rounded-full bg-white border-2 border-dashed border-slate-200 flex items-center justify-center mb-4 shadow-sm">
                                  <i className="fas fa-mouse-pointer text-2xl text-indigo-300"></i>
                              </div>
                              <p className="text-sm font-bold text-slate-600 mb-1">Selecione para Editar</p>
                              <p className="text-xs font-medium text-slate-400">Clique em qualquer texto, botão, fundo ou imagem no slide.</p>
                          </div>
                      ) : (
                          <div className="pb-10 bg-white">
                              <div className="panel-section bg-slate-50/50">
                                  <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-md shadow-sm">{elementoSelecionado.tagName}</span>
                                          <button onClick={() => {
                                              const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
                                              iframe.contentWindow?.postMessage({ type: 'SELECT_PARENT', id: elementoSelecionado.id }, '*');
                                          }} className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 transition flex items-center bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                                              <i className="fas fa-level-up-alt mr-1"></i> Subir Nível
                                          </button>
                                          
                                          <button onClick={duplicarElementoSelecionado} className="text-[9px] font-bold text-blue-600 hover:text-blue-800 transition flex items-center bg-blue-50 border border-blue-200 hover:border-blue-400 px-2 py-1 rounded shadow-sm" title="Clonar Elemento">
                                              <i className="fas fa-copy"></i>
                                          </button>
                                          <button onClick={deletarElementoSelecionado} className="text-[9px] font-bold text-red-500 hover:text-red-700 transition flex items-center bg-red-50 border border-red-200 hover:border-red-400 px-2 py-1 rounded shadow-sm" title="Excluir Elemento">
                                              <i className="fas fa-trash-alt"></i>
                                          </button>
                                      </div>
                                  </div>
                              </div>

                              <div className="panel-section bg-slate-50/50 border-t border-slate-100">
                                  <label className="input-label mb-2 text-[9px] text-slate-500">Inserir Novo Elemento (Abaixo/Dentro)</label>
                                  <div className="flex gap-2 mb-3">
                                      <button onClick={() => adicionarNovoElemento('text')} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[10px] font-bold py-1.5 rounded transition shadow-sm"><i className="fas fa-font mr-1"></i> Texto</button>
                                      <button onClick={() => adicionarNovoElemento('image')} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[10px] font-bold py-1.5 rounded transition shadow-sm"><i className="fas fa-image mr-1"></i> Imagem</button>
                                      <button onClick={() => adicionarNovoElemento('button')} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[10px] font-bold py-1.5 rounded transition shadow-sm"><i className="fas fa-link mr-1"></i> Botão</button>
                                  </div>
                                  
                                  <div className="flex gap-2 border-t border-slate-200 pt-3">
                                      <button onClick={() => moverSecaoInteira('UP')} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[9px] font-bold py-1.5 rounded transition shadow-sm" title="Mover Slide para Trás"><i className="fas fa-level-up-alt"></i> Mover Slide ⬆️</button>
                                      <button onClick={() => moverSecaoInteira('DOWN')} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[9px] font-bold py-1.5 rounded transition shadow-sm" title="Mover Slide para Frente"><i className="fas fa-level-down-alt"></i> Mover Slide ⬇️</button>
                                      <button onClick={inverterLayoutBox} className="flex-1 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-[9px] font-bold py-1.5 rounded transition shadow-sm" title="Inverter Lados da Foto/Texto"><i className="fas fa-exchange-alt"></i> Inverter Lados</button>
                                  </div>
                              </div>

                              {/* PAINEL GLOBAL DE LINKS E ORDENAMENTO SIMPLES */}
                              <div className="p-4 mx-4 mt-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm">
                                  <label className="text-[11px] font-black text-emerald-800 uppercase mb-2 flex items-center"><i className="fas fa-link mr-2 text-emerald-600"></i> Link de Destino</label>
                                  <input type="text" placeholder="Cole o link (Deixe vazio para remover)" value={elementoSelecionado.href || ''} onChange={(e) => atualizarElemento('href', e.target.value)} className="input-standard border-emerald-300 focus:border-emerald-600 font-medium" />
                              </div>

                              <div className="panel-section border-t border-slate-100 flex justify-between items-center mt-2">
                                  <label className="input-label mb-0 text-[10px]">Reordenar (Apenas Elemento)</label>
                                  <div className="flex bg-slate-100 rounded-lg border border-slate-200 p-1">
                                      <button onClick={() => moverElemento('UP')} className="px-3 h-7 flex items-center justify-center rounded text-[10px] transition text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-bold"><i className="fas fa-arrow-up mr-1"></i> Subir</button>
                                      <button onClick={() => moverElemento('DOWN')} className="px-3 h-7 flex items-center justify-center rounded text-[10px] transition text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-bold"><i className="fas fa-arrow-down mr-1"></i> Descer</button>
                                  </div>
                              </div>

                              {elementoSelecionado.tagName === 'img' ? (
                                  <>
                                      <div className="panel-section border-t border-slate-100 mt-2">
                                          <label className="input-label">Mudar Imagem</label>
                                          <input type="text" value={elementoSelecionado.src} onChange={(e) => atualizarElemento('src', e.target.value)} className="input-standard font-mono mb-3 text-[10px]" />
                                          <div className="flex gap-2">
                                              <select value={aiSearchType} onChange={(e) => setAiSearchType(e.target.value)} className="flex-1 input-standard text-[10px] bg-slate-50">
                                                  <option value="realista">Fotografia Realista</option>
                                                  <option value="cinematografica">Cinematográfica (Filme)</option>
                                                  <option value="estudio">Estúdio / Editorial</option>
                                                  <option value="minimalista">Minimalista / Clean</option>
                                              </select>
                                          </div>
                                          <div className="flex gap-2 mt-2">
                                              <button onClick={() => gerarNovaImagemIAAutomatica(false)} className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 rounded-lg transition border border-indigo-100"><i className="fas fa-robot mr-1.5"></i> Usar IA</button>
                                              <label className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold py-2 rounded-lg text-center cursor-pointer transition"><i className="fas fa-upload mr-1.5"></i> Arquivo<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImgElem(e, false)} /></label>
                                          </div>
                                      </div>
                                      
                                      <div className="panel-section border-t border-slate-100">
                                          <label className="input-label mb-2 text-[9px]">Alinhar Imagem</label>
                                          <div className="flex bg-slate-100 rounded-lg border border-slate-200 p-1">
                                              <button onClick={() => atualizarElemento('boxAlign', 'left')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'left' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Esquerda"><i className="fas fa-align-left"></i></button>
                                              <button onClick={() => atualizarElemento('boxAlign', 'center')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'center' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Centro"><i className="fas fa-align-center"></i></button>
                                              <button onClick={() => atualizarElemento('boxAlign', 'right')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'right' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Direita"><i className="fas fa-align-right"></i></button>
                                          </div>
                                      </div>

                                      <div className="panel-section grid grid-cols-2 gap-4">
                                          <div>
                                              <label className="input-label">Proporção (Formato)</label>
                                              <select value={elementoSelecionado.imgFormat || ''} onChange={(e) => {
                                                  const novoFormato = e.target.value;
                                                  atualizarElemento('imgFormat', novoFormato);
                                                  if(novoFormato !== '') {
                                                      gerarNovaImagemIAAutomatica(false, novoFormato);
                                                  }
                                              }} className="input-standard border-indigo-200 focus:border-indigo-500 bg-indigo-50">
                                                  <option value="">Tamanho Original</option>
                                                  <option value="aspect-video">Paisagem (Deitado)</option>
                                                  <option value="aspect-[3/4]">Retrato (Em pé)</option>
                                                  <option value="aspect-square">Quadrado</option>
                                              </select>
                                          </div>
                                          <div>
                                              <label className="input-label">Bordas da Foto</label>
                                              <select value={elementoSelecionado.rounded || 'none'} onChange={(e) => atualizarElemento('imgRounded', e.target.value)} className="input-standard">
                                                  <option value="none">Retas (Simples)</option>
                                                  <option value="rounded-md">Suaves</option>
                                                  <option value="rounded-xl">Arredondadas</option>
                                                  <option value="rounded-full">Círculo Perfeito</option>
                                              </select>
                                          </div>
                                      </div>
                                      
                                      <div className="panel-section">
                                          <label className="input-label flex justify-between">Transparência (Opacidade) <span>{Math.round((elementoSelecionado.opacity || 1) * 100)}%</span></label>
                                          <input type="range" min="0" max="100" value={(elementoSelecionado.opacity || 1) * 100} onChange={(e) => atualizarElemento('opacity', parseInt(e.target.value) / 100)} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2" />
                                      </div>
                                  </>
                              ) : (
                                  <>
                                      <div className="panel-section border-t border-slate-100 mt-2">
                                          {elementoSelecionado.bloqueiaTexto ? (
                                              <div className="bg-orange-50 p-3 rounded-lg border border-orange-200 text-orange-800 mb-4">
                                                  <p className="text-xs font-bold mb-1"><i className="fas fa-exclamation-triangle"></i> Container Estrutural</p>
                                                  <p className="text-[10px] leading-relaxed">Clique em textos ou botões para editar seus conteúdos. Neste painel você ajusta a Posição, Cor e Fundo desta caixa.</p>
                                              </div>
                                          ) : (
                                              <div className="mb-4">
                                                  <label className="input-label mb-2">Texto do Elemento</label>
                                                  <textarea rows={4} value={elementoSelecionado.text} onChange={(e) => atualizarElemento('text', e.target.value, true)} className="input-standard resize-y shadow-inner text-sm"></textarea>
                                              </div>
                                          )}

                                          <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                  <label className="input-label mb-2 text-[9px]">Alinhar Texto</label>
                                                  <div className="flex bg-slate-100 rounded-lg border border-slate-200 p-1">
                                                      <button onClick={() => atualizarElemento('textAlign', 'text-left')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.textAlign === 'text-left' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`}><i className="fas fa-align-left"></i></button>
                                                      <button onClick={() => atualizarElemento('textAlign', 'text-center')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.textAlign === 'text-center' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`}><i className="fas fa-align-center"></i></button>
                                                      <button onClick={() => atualizarElemento('textAlign', 'text-right')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.textAlign === 'text-right' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`}><i className="fas fa-align-right"></i></button>
                                                  </div>
                                              </div>
                                              <div>
                                                  <label className="input-label mb-2 text-[9px]">Alinhar Bloco</label>
                                                  <div className="flex bg-slate-100 rounded-lg border border-slate-200 p-1">
                                                      <button onClick={() => atualizarElemento('boxAlign', 'left')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'left' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Mover para a Esquerda"><i className="fas fa-align-left"></i></button>
                                                      <button onClick={() => atualizarElemento('boxAlign', 'center')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'center' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Centralizar Caixa"><i className="fas fa-align-center"></i></button>
                                                      <button onClick={() => atualizarElemento('boxAlign', 'right')} className={`flex-1 h-7 flex items-center justify-center rounded text-[10px] transition ${elementoSelecionado.boxAlign === 'right' ? 'bg-white shadow-sm text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-200'}`} title="Mover para a Direita"><i className="fas fa-align-right"></i></button>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      {/* FORMATADOR DE BOTÕES, LINKS E CAIXAS */}
                                      {(elementoSelecionado.tagName === 'a' || elementoSelecionado.tagName === 'button' || elementoSelecionado.tagName === 'div') && (
                                          <div className="panel-section border-t border-slate-100 bg-slate-50/30">
                                              <label className="input-label mb-3"><i className="fas fa-expand-arrows-alt text-slate-400"></i> Tamanho e Estrutura</label>
                                              
                                              <div className="grid grid-cols-2 gap-4 mb-4">
                                                  <div>
                                                      <div className="flex justify-between items-center mb-1">
                                                          <label className="text-[9px] text-slate-500">Largura (Lateral)</label>
                                                          {elementoSelecionado.paddingX?.startsWith('px-[') && <span className="text-[9px] font-bold text-indigo-600">{elementoSelecionado.paddingX.match(/\d+/)?.[0]}px</span>}
                                                      </div>
                                                      <select value={elementoSelecionado.paddingX?.startsWith('px-[') ? 'custom' : (elementoSelecionado.paddingX || 'none')} onChange={(e) => {
                                                          if(e.target.value === 'custom') { atualizarElemento('paddingX', 'px-[40px]'); }
                                                          else { atualizarElemento('paddingX', e.target.value); }
                                                      }} className="input-standard">
                                                          <option value="none">Padrão</option>
                                                          <option value="px-4">Pequena</option>
                                                          <option value="px-8">Média</option>
                                                          <option value="px-12">Grande</option>
                                                          <option value="px-16">Extra Grande</option>
                                                          <option value="px-24">Gigante</option>
                                                          <option value="w-full text-center">Largura Total (Cheia)</option>
                                                          <option value="custom">Personalizado (Slider)</option>
                                                      </select>
                                                      {elementoSelecionado.paddingX?.startsWith('px-[') && (
                                                          <input type="range" min="0" max="300" value={parseInt(elementoSelecionado.paddingX.match(/\d+/)?.[0] || '40')} onChange={(e) => atualizarElemento('paddingX', `px-[${e.target.value}px]`)} className="w-full h-1.5 mt-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                                      )}
                                                  </div>
                                                  <div>
                                                      <div className="flex justify-between items-center mb-1">
                                                          <label className="text-[9px] text-slate-500">Altura (Vertical)</label>
                                                          {elementoSelecionado.paddingY?.startsWith('py-[') && <span className="text-[9px] font-bold text-indigo-600">{elementoSelecionado.paddingY.match(/\d+/)?.[0]}px</span>}
                                                      </div>
                                                      <select value={elementoSelecionado.paddingY?.startsWith('py-[') ? 'custom' : (elementoSelecionado.paddingY || 'none')} onChange={(e) => {
                                                          if(e.target.value === 'custom') { atualizarElemento('paddingY', 'py-[16px]'); }
                                                          else { atualizarElemento('paddingY', e.target.value); }
                                                      }} className="input-standard">
                                                          <option value="none">Padrão</option>
                                                          <option value="py-2">Fino</option>
                                                          <option value="py-4">Médio</option>
                                                          <option value="py-6">Grosso</option>
                                                          <option value="py-8">Extra Grosso</option>
                                                          <option value="py-12">Gigante</option>
                                                          <option value="custom">Personalizado (Slider)</option>
                                                      </select>
                                                      {elementoSelecionado.paddingY?.startsWith('py-[') && (
                                                          <input type="range" min="0" max="150" value={parseInt(elementoSelecionado.paddingY.match(/\d+/)?.[0] || '16')} onChange={(e) => atualizarElemento('paddingY', `py-[${e.target.value}px]`)} className="w-full h-1.5 mt-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                                                      )}
                                                  </div>
                                              </div>
                                              
                                              <label className="input-label mb-2"><i className="fas fa-shapes text-slate-400"></i> Estilo e Profundidade</label>
                                              <div className="grid grid-cols-2 gap-4 mb-4">
                                                  <div>
                                                      <label className="text-[9px] text-slate-500 mb-1 block">Arredondamento</label>
                                                      <select value={elementoSelecionado.rounded || 'none'} onChange={(e) => atualizarElemento('rounded', e.target.value)} className="input-standard">
                                                          <option value="none">Reto (Quadrado)</option>
                                                          <option value="rounded-md">Leve</option>
                                                          <option value="rounded-xl">Arredondado</option>
                                                          <option value="rounded-full">Pílula</option>
                                                      </select>
                                                  </div>
                                                  <div>
                                                      <label className="text-[9px] text-slate-500 mb-1 block">Espessura da Borda</label>
                                                      <select value={elementoSelecionado.borderW || 'none'} onChange={(e) => atualizarElemento('borderW', e.target.value)} className="input-standard">
                                                          <option value="none">Sem Borda</option>
                                                          <option value="border-2">Fina</option>
                                                          <option value="border-4">Grossa</option>
                                                      </select>
                                                  </div>
                                              </div>

                                              <div>
                                                  <label className="text-[9px] text-slate-500 mb-1 block">Sombra</label>
                                                  <select value={elementoSelecionado.shadow || 'none'} onChange={(e) => atualizarElemento('shadow', e.target.value)} className="input-standard">
                                                      <option value="none">Plano</option>
                                                      <option value="shadow-md">Sombra Suave</option>
                                                      <option value="shadow-xl">Sombra Projetada</option>
                                                      <option value="shadow-2xl shadow-indigo-500/50">Brilho Colorido (Glow)</option>
                                                  </select>
                                              </div>
                                          </div>
                                      )}
                                      
                                      <div className="panel-section grid grid-cols-2 gap-5 border-t border-slate-100">
                                          <div>
                                              <label className="input-label flex justify-between">Tamanho da Letra <span>{elementoSelecionado.fontSize}px</span></label>
                                              <input type="range" min="10" max="120" value={elementoSelecionado.fontSize || 16} onChange={(e) => atualizarElemento('fontSize', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-3" />
                                          </div>
                                          <div className="flex flex-col gap-3">
                                              <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-slate-600 uppercase">Cor do Fundo</label>
                                                  <input type="color" value={elementoSelecionado.bgColor || '#ffffff'} onChange={(e) => atualizarElemento('bgColor', e.target.value)} className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0 shadow-sm" />
                                              </div>
                                              <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-slate-600 uppercase">Cor da Borda</label>
                                                  <input type="color" value={elementoSelecionado.borderColor || '#cccccc'} onChange={(e) => atualizarElemento('borderColor', e.target.value)} className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0 shadow-sm" />
                                              </div>
                                              <div className="flex justify-between items-center">
                                                  <label className="text-[10px] font-bold text-slate-600 uppercase">Cor da Letra</label>
                                                  <input type="color" value={elementoSelecionado.textColor || '#000000'} onChange={(e) => atualizarElemento('textColor', e.target.value)} className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0 shadow-sm" />
                                              </div>
                                          </div>
                                      </div>

                                      <div className="panel-section border-t border-slate-100">
                                          <label className="input-label flex justify-between">Opacidade da Cor (Película) <span>{Math.round((elementoSelecionado.opacity || 1) * 100)}%</span></label>
                                          <input type="range" min="0" max="100" value={(elementoSelecionado.opacity || 1) * 100} onChange={(e) => atualizarElemento('opacity', parseInt(e.target.value) / 100)} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2" />
                                      </div>

                                      <div className="panel-section border-t border-slate-100">
                                          <label className="input-label flex items-center gap-1.5"><i className="fas fa-image text-slate-400"></i> Fundo do Slide</label>
                                          <div className="flex gap-2 mb-2">
                                              <input type="text" placeholder="Link direto da imagem..." value={elementoSelecionado.bgImage || ''} onChange={(e) => atualizarElemento('bgImage', e.target.value)} className="input-standard flex-1 text-[10px]" />
                                          </div>
                                          <div className="flex gap-2">
                                              <select value={aiSearchType} onChange={(e) => setAiSearchType(e.target.value)} className="flex-1 input-standard text-[10px] bg-slate-50">
                                                  <option value="realista">Fotografia Realista</option>
                                                  <option value="cinematografica">Cinematográfica (Filme)</option>
                                                  <option value="estudio">Estúdio / Editorial</option>
                                                  <option value="minimalista">Minimalista / Clean</option>
                                              </select>
                                          </div>
                                          <div className="flex gap-2 mt-2">
                                              <button onClick={() => gerarNovaImagemIAAutomatica(true)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold py-1.5 rounded transition"><i className="fas fa-robot mr-1"></i> Usar IA</button>
                                              <label className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold py-1.5 rounded text-center cursor-pointer transition"><i className="fas fa-desktop mr-1"></i> Arquivo<input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImgElem(e, true)} /></label>
                                          </div>
                                      </div>

                                      <div className="panel-section bg-slate-50/50 border-t border-slate-100">
                                          <label className="input-label">Efeitos Interativos (Ao passar o mouse)</label>
                                          <select onChange={(e) => atualizarElemento('animationClass', e.target.value)} className="input-standard font-medium">
                                              <option value="">Nenhum</option>
                                              <option value="hover:scale-105 transition-transform duration-300">Aumentar Suavemente (Zoom In)</option>
                                              <option value="hover:-translate-y-2 transition-transform duration-300">Levantar Levemente (Flutuar)</option>
                                              <option value="hover:shadow-2xl hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300">Levantar com Brilho Colorido</option>
                                              <option value="hover:rotate-3 transition-transform duration-300">Inclinação Dinâmica</option>
                                              <option value="animate-pulse">Pulsar sem parar (Atenção Máxima)</option>
                                              <option value="animate-bounce">Balançar (Tremidinha)</option>
                                          </select>
                                      </div>
                                  </>
                              )}

                              {/* PAINEL DO COPYWRITER IA */}
                              <div className="m-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 shadow-xl text-white">
                                  <label className="text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-4 flex items-center"><i className="fas fa-robot text-xl mr-2 text-white"></i> Otimização com IA</label>
                                  
                                  {elementoSelecionado.tagName !== 'img' && !elementoSelecionado.bloqueiaTexto && (
                                      <div className="grid grid-cols-2 gap-2.5 mb-4">
                                          <button onClick={() => otimizarComIA("Reescreva o slide com copy persuasiva para prender a atenção da audiência, deixando o texto corporativo e elegante.")} className="bg-slate-700 hover:bg-slate-600 text-[10px] font-bold py-2.5 rounded-lg text-white transition shadow-sm border border-slate-600">Mais Persuasivo</button>
                                          <button onClick={() => otimizarComIA("Reescreva resumindo este slide de forma clara e direta (bullet points se necessário) focando nos pontos chave.")} className="bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold py-2.5 rounded-lg text-white transition shadow-sm border border-indigo-500 flex items-center justify-center gap-1.5">Resumir Tópico</button>
                                      </div>
                                  )}
                                  <div className="flex gap-2 relative">
                                      <input type="text" id="ai_prompt_element" placeholder="Instrução customizada para a IA..." className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-4 py-3 outline-none focus:border-indigo-400 placeholder-slate-400" />
                                      <button onClick={() => otimizarComIA()} className="absolute right-1.5 top-1.5 bottom-1.5 w-10 bg-indigo-600 hover:bg-indigo-500 rounded-md flex items-center justify-center transition shadow-sm"><i className="fas fa-paper-plane"></i></button>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              ) : (
                  
                  <div className="animate-[fadeIn_0.2s_ease] pb-12 bg-white flex flex-col h-full overflow-hidden">
                      
                      <div className="flex p-2 bg-slate-50 border-b border-slate-200 gap-1.5 overflow-x-auto custom-scrollbar flex-shrink-0">
                          <button onClick={() => setAbaAtiva('gerar')} className={`whitespace-nowrap flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition flex justify-center items-center ${abaAtiva === 'gerar' ? 'bg-white shadow border border-slate-200 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}><i className="fas fa-magic mr-1.5"></i> Criar Slide</button>
                          <button onClick={() => setAbaAtiva('blocos')} className={`whitespace-nowrap flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition flex justify-center items-center ${abaAtiva === 'blocos' ? 'bg-white shadow border border-slate-200 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}><i className="fas fa-cubes mr-1.5"></i> Modelos</button>
                      </div>

                      {abaAtiva === 'blocos' ? (
                          <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                              <div>
                                  <h3 className="text-xs font-black uppercase text-slate-800 mb-3.5 tracking-wide flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-500"><i className="fas fa-layer-group"></i></span> Templates de Slide</h3>
                                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">Adicione slides completos à sua apresentação. Eles entrarão <b>após o slide selecionado</b>.</p>
                                  
                                  <div className="space-y-4">
                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Slide de FAQ</p>
                                              <p className="text-[10px] text-slate-500">Perguntas Frequentes do Público</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('faq')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Slide de Garantia</p>
                                              <p className="text-[10px] text-slate-500">Argumentação de Risco Zero</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('garantia')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Slide de Casos</p>
                                              <p className="text-[10px] text-slate-500">Exemplos e Métricas Reais</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('depoimentos')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Slide Financeiro</p>
                                              <p className="text-[10px] text-slate-500">Investimento e Escopo de Projeto</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('precoDestaque')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Capa do Palestrante (Esq)</p>
                                              <p className="text-[10px] text-slate-500">Foto e Introdução da Autoridade</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('autorEsq')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>

                                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between hover:border-indigo-300 transition-colors">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">Capa do Palestrante (Dir)</p>
                                              <p className="text-[10px] text-slate-500">Foto e Introdução da Autoridade</p>
                                          </div>
                                          <button onClick={() => injetarBlocoPronto('autorDir')} className="w-10 h-10 bg-white border border-slate-200 text-indigo-600 rounded-full flex items-center justify-center shadow-sm hover:bg-indigo-50 transition"><i className="fas fa-plus"></i></button>
                                      </div>
                                  </div>

                                  <div className="mt-8 pt-6 border-t border-slate-100">
                                      <h3 className="text-xs font-black uppercase text-slate-800 mb-3.5 tracking-wide flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-500"><i className="fas fa-code-branch"></i></span> Alteração Global em Massa</h3>
                                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">Deixe a IA modificar toda a estrutura da apresentação para você (ex: Trocar todas as cores, alterar fonte geral).</p>
                                      <textarea id="refineGlobalContent" className="input-standard h-28 resize-none leading-relaxed text-sm p-4 rounded-xl shadow-inner border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50" placeholder="Ex: Deixe todos os slides no modo escuro profundo..."></textarea>
                                      <button onClick={executarRefinamentoGlobal} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2">
                                          <i className="fas fa-magic text-yellow-300 text-lg"></i> Aplicar na Apresentação
                                      </button>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                              <div>
                                  <h3 className="text-xs font-black uppercase text-slate-800 mb-3.5 tracking-wide flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-500">1</span> Cores e Estilo Visual</h3>
                                  <div className="space-y-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                      
                                      <div>
                                          <label className="input-label mb-2">Tipografia Institucional</label>
                                          <select value={fontFamily} onChange={(e) => aplicarFonte(e.target.value)} className="input-standard font-medium text-slate-800">
                                              <option value="sans-serif">Padrão do Sistema</option>
                                              <option value="Inter">Inter (Moderna e Limpa)</option>
                                              <option value="Montserrat">Montserrat (Larga e Corporativa)</option>
                                              <option value="Playfair Display">Playfair Display (Premium Serifada)</option>
                                              <option value="Roboto">Roboto (Clássica e Neutra)</option>
                                              <option value="Lora">Lora (Leitura Acadêmica)</option>
                                          </select>
                                      </div>

                                      <div className="pt-2 border-t border-slate-100">
                                          <label className="input-label mb-2">Paleta Base de Apresentação</label>
                                          <div className="flex flex-wrap gap-2.5">
                                              {[
                                                  {id: 'auto', cor: 'bg-gradient-to-r from-blue-400 to-purple-500', title: 'Extrair da Imagem'},
                                                  {id: 'dark', cor: 'bg-slate-900', title: 'Modo Escuro (Contraste Alto)'},
                                                  {id: 'azul', cor: 'bg-blue-600', title: 'Azul Institucional'},
                                                  {id: 'verde', cor: 'bg-emerald-500', title: 'Verde ESG / Financeiro'},
                                                  {id: 'roxo', cor: 'bg-purple-600', title: 'Roxo Criativo'},
                                                  {id: 'rosa', cor: 'bg-pink-500', title: 'Rosa Suave'},
                                                  {id: 'vermelho', cor: 'bg-red-600', title: 'Vermelho Impacto'},
                                                  {id: 'amarelo', cor: 'bg-yellow-400', title: 'Amarelo Alerta'},
                                                  {id: 'laranja', cor: 'bg-orange-500', title: 'Laranja Engajamento'},
                                                  {id: 'terracota', cor: 'bg-amber-700', title: 'Terracota Conforto'},
                                                  {id: 'cinza', cor: 'bg-zinc-500', title: 'Cinza Analítico'},
                                                  {id: 'personalizada', cor: 'bg-white border-2 border-dashed border-slate-300', title: 'Escolher Manualmente'}
                                              ].map(c => (
                                                  <button key={c.id} onClick={() => setCorSelecionada(c.id)} className={`w-8 h-8 rounded-full shadow-sm transition-transform ${corSelecionada === c.id ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'hover:scale-105'} ${c.cor} flex items-center justify-center`} title={c.title}>
                                                      {c.id === 'auto' && <i className="fas fa-wand-magic-sparkles text-white text-[10px]"></i>}
                                                      {c.id === 'personalizada' && <i className="fas fa-plus text-slate-400 text-[10px]"></i>}
                                                  </button>
                                              ))}
                                          </div>
                                          
                                          {corSelecionada === 'personalizada' && (
                                              <div className="flex gap-3 mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 animate-[fadeIn_0.2s_ease]">
                                                  <div className="flex-1"><label className="input-label">Fundo</label><input type="color" id="corFundo" className="w-full h-8 rounded-md cursor-pointer p-0 border border-slate-300 shadow-sm" defaultValue="#ffffff" /></div>
                                                  <div className="flex-1"><label className="input-label">Destaque</label><input type="color" id="corPrimaria" className="w-full h-8 rounded-md cursor-pointer p-0 border border-slate-300 shadow-sm" defaultValue="#4f46e5" /></div>
                                              </div>
                                          )}
                                      </div>

                                      <div className="pt-2 border-t border-slate-100">
                                          <label htmlFor="nichoEstilo" className="input-label">Diretriz de Design</label>
                                          <select id="nichoEstilo" value={nichoEstilo} onChange={(e) => setNichoEstilo(e.target.value)} className="input-standard text-sm font-bold text-slate-700">
                                              <option value="minimalista">Clean e Corporativo</option>
                                              <option value="premium">Premium Elegante (Keynote)</option>
                                              <option value="agressivo">Venda de Palco (Alto Impacto)</option>
                                              <option value="terapia">Acolhedor e Acadêmico</option>
                                          </select>
                                      </div>
                                  </div>
                              </div>

                              {/* A NOVA SEÇÃO 3: HÍBRIDA (COPY + REFERÊNCIA) */}
                              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                                  <h3 className="text-xs font-black uppercase text-indigo-900 mb-3 tracking-wide flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span> Base da Apresentação</h3>
                                  
                                  <div className="mb-4">
                                      <label className="input-label text-indigo-800">Texto / Tópicos / Roteiro</label>
                                      <textarea 
                                          value={productContent} 
                                          maxLength={5000} 
                                          onChange={(e) => setProductContent(e.target.value)} 
                                          className="input-standard h-28 resize-y leading-relaxed text-sm p-4 rounded-xl border-indigo-200 shadow-inner" 
                                          placeholder="Cole os tópicos da aula, o roteiro da palestra ou comandos extras para a IA estruturar os slides... (Até 5.000 caracteres)"
                                      ></textarea>
                                      <div className="text-right text-[9px] text-indigo-400 mt-1 font-bold">{productContent.length}/5000</div>
                                  </div>

                                  <div className="mb-4">
                                      <label className="input-label text-indigo-800">Identidade Visual (Imagem Base)</label>
                                      <div className="bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-colors rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer shadow-sm" onClick={() => document.getElementById('imageUploadInput')?.click()}>
                                          <div className="w-10 h-10 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mb-2"><i className="fas fa-image text-lg"></i></div>
                                          <p className="text-xs font-bold text-slate-700">Anexar referência de Layout</p>
                                          <p className="text-[10px] font-medium text-slate-500 mt-0.5">Ou cole aqui (Ctrl+V)</p>
                                      </div>
                                      <input type="file" id="imageUploadInput" multiple accept="image/*" className="hidden" onChange={handleImageUploadInput} />
                                      
                                      {uploadedImages.length > 0 && (
                                          <div className="flex gap-3 mt-3 overflow-x-auto pb-2 custom-scrollbar">
                                              {uploadedImages.map((imgObj, idx) => (
                                                  <div key={idx} className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 border-indigo-200 shadow-sm group">
                                                      <img src={`data:${imgObj.mimeType};base64,${imgObj.data}`} className="w-full h-full object-cover" />
                                                      <button className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" onClick={(e) => { e.stopPropagation(); removerImagem(idx); }}><i className="fas fa-trash text-sm"></i></button>
                                                  </div>
                                              ))}
                                          </div>
                                      )}
                                  </div>

                                  <button onClick={executarGeracaoSiteHibrida} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider py-4 rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 text-sm flex items-center justify-center gap-2">
                                      <i className="fas fa-rocket text-yellow-300 text-lg"></i> Gerar Apresentação Agora
                                  </button>
                              </div>

                          </div>
                      )}
                  </div>
              )}
          </div>
      </div>

      <div className="flex-grow flex flex-col bg-slate-200 relative min-w-0">
          
          <div className="bg-white border-b border-slate-200 flex justify-between items-center px-4 md:px-6 h-[60px] shadow-sm z-10">
              <div className="flex items-center gap-3 md:gap-5">
                  <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button id="tabPreview" onClick={() => (window as any).mudarSeparador('preview')} className="px-5 py-2 rounded-md font-bold text-xs bg-white text-indigo-700 shadow-sm transition">Ver Slides</button>
                      <button id="tabCode" onClick={() => (window as any).mudarSeparador('code')} className="px-5 py-2 rounded-md font-bold text-xs text-slate-500 hover:text-slate-800 transition">Código Fonte</button>
                  </div>
                  
                  {/* SIMULADOR DE DISPOSITIVOS */}
                  <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                  <div className="hidden md:flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button onClick={() => setDeviceView('desktop')} className={`w-8 h-7 flex items-center justify-center rounded transition ${deviceView === 'desktop' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`} title="16:9 Slide Monitor"><i className="fas fa-desktop text-xs"></i></button>
                      <button onClick={() => setDeviceView('tablet')} className={`w-8 h-7 flex items-center justify-center rounded transition ${deviceView === 'tablet' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`} title="Visão Tablet"><i className="fas fa-tablet-alt text-xs"></i></button>
                      <button onClick={() => setDeviceView('mobile')} className={`w-8 h-7 flex items-center justify-center rounded transition ${deviceView === 'mobile' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`} title="Vertical Mobile"><i className="fas fa-mobile-alt text-xs"></i></button>
                  </div>

                  <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                  <button onClick={() => setModalImportarCodigo(true)} className="hidden lg:flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 text-xs font-bold transition px-3 py-1.5 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm">
                      <i className="fas fa-file-import"></i> Importar HTML
                  </button>
                  <button onClick={() => setModalSEO(true)} className="hidden lg:flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 text-xs font-bold transition px-3 py-1.5 rounded hover:bg-slate-100 border border-transparent hover:border-slate-200 shadow-none hover:shadow-sm">
                      <i className="fas fa-cog"></i> Ajustes de Slide
                  </button>
                  
                  <div className="w-px h-6 bg-slate-200 hidden lg:block"></div>
                  <button onClick={desfazerCodigo} className="hidden lg:flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-xs font-bold transition px-2 py-1 rounded hover:bg-slate-100"><i className="fas fa-undo"></i> Desfazer</button>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                  <button onClick={carregarMeusSites} className="text-slate-600 hover:text-indigo-600 font-bold text-xs px-3 py-2 rounded hover:bg-slate-100 transition"><i className="fas fa-presentation mr-1.5"></i> Minhas Apresentações</button>
                  <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
                  
                  <div className="flex bg-slate-50 rounded-lg border border-slate-200 mr-1 hidden xl:flex">
                      <button onClick={() => (window as any).baixarPDF()} className="text-slate-500 hover:text-red-600 text-xs px-3 py-2 border-r border-slate-200 transition" title="Exportar para PDF"><i className="fas fa-file-pdf mr-1"></i> PDF</button>
                      <button onClick={() => (window as any).baixarPPTX()} className="text-slate-500 hover:text-orange-600 text-xs px-3 py-2 border-r border-slate-200 transition" title="Exportar para PowerPoint"><i className="fas fa-file-powerpoint mr-1"></i> PPTX</button>
                      <button onClick={() => (window as any).baixarHtmlGerado()} className="text-slate-500 hover:text-indigo-600 text-xs px-3 py-2 border-r border-slate-200 transition" title="Baixar Código Fonte Original"><i className="fas fa-code"></i></button>
                  </div>
                  
                  {siteEditando ? (
                      <div className="flex gap-2">
                          <button onClick={() => setSiteEditando(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition border border-slate-200">Cancelar</button>
                          <button onClick={() => (window as any).handlePublicarSite()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition shadow-md flex items-center"><i className="fas fa-cloud-upload-alt mr-1.5"></i> Salvar Edição</button>
                      </div>
                  ) : (
                      <button onClick={() => (window as any).handlePublicarSite()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide rounded-lg shadow-md shadow-indigo-200 transition hover:-translate-y-0.5 flex items-center"><i className="fas fa-link mr-1.5"></i> Gerar Link</button>
                  )}
              </div>
          </div>
          
          <div className="flex-grow relative bg-slate-200 p-0 md:p-6 lg:p-8 overflow-hidden flex justify-center custom-scrollbar">
              {modoInspetor && (
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-8 py-3 rounded-full shadow-2xl shadow-indigo-500/50 font-black text-xs uppercase tracking-widest flex items-center gap-3 border-[3px] border-indigo-400 animate-bounce pointer-events-none">
                      <i className="fas fa-mouse-pointer text-yellow-300"></i> Pode Clicar e Editar!
                  </div>
              )}
              
              <div className={`mx-auto shadow-2xl relative flex flex-col overflow-hidden transition-all duration-500 bg-white ${modoInspetor ? 'ring-4 ring-indigo-500/30 rounded-xl' : 'border border-slate-300'} ${deviceView === 'mobile' ? 'w-[400px] h-[711px] shrink-0' : deviceView === 'tablet' ? 'w-[800px] h-full shrink-0' : 'aspect-video w-full max-w-[1280px]'}`}>
                  {modoInspetor && (
                      <div className="h-7 w-full bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-1.5 flex-shrink-0">
                          <div className="w-3 h-3 rounded-full bg-slate-300"></div><div className="w-3 h-3 rounded-full bg-slate-300"></div><div className="w-3 h-3 rounded-full bg-slate-300"></div>
                          <div className="mx-auto bg-white border border-slate-200 text-[9px] text-slate-500 px-10 py-0.5 rounded-full font-bold">Visualização do Slide</div>
                      </div>
                  )}
                  <iframe id="previewFrame" className="w-full flex-1 border-none active bg-slate-900" sandbox="allow-scripts allow-same-origin" title="Navegador do Site"></iframe>
                  <div id="codigoContainer" className="w-full h-full bg-[#0d1117] relative">
                      <textarea id="codigoGerado" className="absolute inset-0 w-full h-full font-mono text-[13px] bg-[#0d1117] text-[#56d364] border-none outline-none resize-none custom-scrollbar p-8 leading-relaxed"
                          onBlur={(e) => {
                              const newHtml = e.target.value;
                              const iframe = document.getElementById('previewFrame') as HTMLIFrameElement;
                              if (iframe) { iframe.srcdoc = newHtml + SCRIPT_PREVIEW; }
                              setHistoricoCodigo(prev => {
                                  if (prev.length > 0 && prev[prev.length - 1] === newHtml) return prev;
                                  return [...prev, newHtml];
                              });
                          }}
                      ></textarea>
                  </div>
              </div>
          </div>
      </div>
      
      {modalMeusSitesAberto && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <h2 className="text-xl font-black text-slate-800 flex items-center"><i className="fas fa-server text-indigo-500 mr-2.5"></i> Apresentações Salvas</h2>
              <button onClick={() => setModalMeusSitesAberto(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition font-bold"><i className="fas fa-times"></i></button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50">
              {carregandoSites ? <div className="text-center py-16"><i className="fas fa-circle-notch fa-spin text-4xl text-indigo-500 mb-4"></i><p className="text-sm font-bold text-slate-500">Buscando apresentações...</p></div> : listaSites.length === 0 ? <div className="text-center py-20"><i className="fas fa-folder-open text-6xl text-slate-300 mb-4"></i><p className="text-lg font-bold text-slate-600">Você ainda não tem nenhuma apresentação.</p><p className="text-sm text-slate-400 mt-2">Gere seus primeiros slides e publique para aparecer aqui!</p></div> : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {sitesAtuais.map((site) => {
                        const linkUrl = `${window.location.origin}/${site.slug}`;
                        return (
                          <div key={site.id} className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all bg-white flex flex-col group">
                            <h3 className="font-black text-base text-slate-800 mb-3 truncate group-hover:text-indigo-700 transition-colors">{site.titulo}</h3>
                            <div className="flex bg-slate-50 border border-slate-200 rounded-lg text-xs overflow-hidden mb-5">
                                <span className="bg-slate-100 text-slate-500 px-3 py-2 border-r border-slate-200 flex items-center"><i className="fas fa-link"></i></span>
                                <input type="text" readOnly value={linkUrl} className="bg-transparent w-full p-2 outline-none font-mono text-slate-600" />
                            </div>
                            <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                              <a href={`/${site.slug}`} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase text-indigo-600 hover:text-indigo-800 transition flex items-center"><i className="fas fa-external-link-alt mr-1.5"></i> Abrir Link Visualizador</a>
                              <div className="flex gap-2">
                                <button onClick={() => editarSite(site)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition shadow-sm"><i className="fas fa-pen mr-1"></i> Abrir no Painel</button>
                                <button onClick={() => deletarSite(site.id, site.slug)} className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg transition" title="Deletar Projeto"><i className="fas fa-trash"></i></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {totalPaginas > 1 && (
                      <div className="flex justify-center items-center gap-4 mt-8 pt-6">
                        <button onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))} disabled={paginaAtual === 1} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50 transition shadow-sm"><i className="fas fa-chevron-left"></i> Voltar</button>
                        <span className="text-xs font-black text-slate-500 tracking-widest uppercase bg-white px-4 py-2 rounded-lg border border-slate-200">Página {paginaAtual} de {totalPaginas}</span>
                        <button onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))} disabled={paginaAtual === totalPaginas} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg disabled:opacity-50 hover:bg-slate-50 transition shadow-sm">Próxima <i className="fas fa-chevron-right ml-1"></i></button>
                      </div>
                    )}
                  </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}