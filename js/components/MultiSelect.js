import { getLocale, translateText } from '../i18n.js';

export class MultiSelect {
    constructor(containerId, options, config = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = (options || []).map(option => (
            typeof option === 'object'
                ? { label: String(option.label), value: String(option.value) }
                : { label: String(option), value: String(option) }
        ));
        this.selectedValues = (config.defaultSelected || []).map(String);
        this.placeholder = config.placeholder || '選択してください...';
        this.onChange = config.onChange || (() => { });
        this.id = `ms-${Math.random().toString(36).slice(2, 11)}`;
        this.activeOptionIndex = 0;

        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="multiselect-wrapper" id="${this.id}">
                <div class="multiselect-input">
                    <div class="multiselect-tags"></div>
                    <button type="button" class="multiselect-trigger"
                        aria-haspopup="listbox" aria-expanded="false"
                        aria-controls="${this.id}-listbox">
                        <span class="multiselect-placeholder"></span>
                        <i class="fas fa-chevron-down multiselect-chevron" aria-hidden="true"></i>
                    </button>
                </div>
                <div class="multiselect-dropdown" hidden>
                    <ul class="multiselect-options" id="${this.id}-listbox"
                        role="listbox" aria-multiselectable="true" tabindex="-1"></ul>
                </div>
                <div class="sr-only multiselect-status" aria-live="polite" aria-atomic="true"></div>
            </div>
        `;
        this.updateTags();
        this.updateOptions();
        this.updateAccessibleLabels();
    }

    getText(japanese, english) {
        return getLocale() === 'en' ? english : japanese;
    }

    localizedPlaceholder() {
        return translateText(this.placeholder, getLocale());
    }

    labelForValue(value) {
        return this.options.find(option => option.value === value)?.label || value;
    }

    updateAccessibleLabels() {
        const trigger = this.container.querySelector('.multiselect-trigger');
        const list = this.container.querySelector('.multiselect-options');
        const tags = this.container.querySelector('.multiselect-tags');
        const placeholder = this.container.querySelector('.multiselect-placeholder');
        const count = this.selectedValues.length;

        placeholder.textContent = count === 0
            ? this.localizedPlaceholder()
            : this.getText(`${count}項目を選択中`, `${count} selected`);
        trigger.setAttribute('aria-label', count === 0
            ? this.localizedPlaceholder()
            : this.getText(`${count}項目を選択中。選択肢を開く`, `${count} selected. Open options`));
        list.setAttribute('aria-label', this.getText('選択肢', 'Options'));
        tags.setAttribute('aria-label', this.getText('選択済みの項目', 'Selected items'));
    }

    updateTags() {
        const tagsContainer = this.container.querySelector('.multiselect-tags');
        tagsContainer.replaceChildren();

        this.selectedValues.forEach(value => {
            const label = this.labelForValue(value);
            const tag = document.createElement('span');
            tag.className = 'multiselect-tag';

            const text = document.createElement('span');
            text.textContent = label;
            tag.appendChild(text);

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'multiselect-remove';
            remove.dataset.value = value;
            remove.setAttribute('aria-label', this.getText(
                `${label}を選択から外す`,
                `Remove ${label} from selection`
            ));
            remove.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
            tag.appendChild(remove);
            tagsContainer.appendChild(tag);
        });

        this.updateAccessibleLabels();
    }

    updateOptions() {
        const list = this.container.querySelector('.multiselect-options');
        list.replaceChildren();

        if (this.options.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'no-options';
            empty.textContent = this.getText('選択可能な項目はありません', 'No options available');
            list.appendChild(empty);
            return;
        }

        this.options.forEach((option, index) => {
            const item = document.createElement('li');
            item.className = 'multiselect-option';
            item.id = `${this.id}-option-${index}`;
            item.dataset.value = option.value;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(this.selectedValues.includes(option.value)));
            item.classList.toggle('selected', this.selectedValues.includes(option.value));
            item.setAttribute('tabindex', '-1');
            item.textContent = option.label;
            list.appendChild(item);
        });
    }

    setOpen(open, focusPosition = null) {
        const wrapper = this.container.querySelector('.multiselect-wrapper');
        const trigger = wrapper.querySelector('.multiselect-trigger');
        const dropdown = wrapper.querySelector('.multiselect-dropdown');
        wrapper.classList.toggle('active', open);
        trigger.setAttribute('aria-expanded', String(open));
        dropdown.hidden = !open;

        if (open && focusPosition !== null) {
            const options = Array.from(wrapper.querySelectorAll('.multiselect-option'));
            if (options.length === 0) return;
            const selectedIndex = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
            this.activeOptionIndex = focusPosition === 'last'
                ? options.length - 1
                : Math.max(0, selectedIndex);
            options[this.activeOptionIndex].focus();
        }
    }

    toggleValue(value, announce = true) {
        const isSelected = this.selectedValues.includes(value);
        this.selectedValues = isSelected
            ? this.selectedValues.filter(selected => selected !== value)
            : [...this.selectedValues, value];
        this.updateTags();
        this.updateOptions();
        this.onChange([...this.selectedValues]);

        if (announce) {
            const label = this.labelForValue(value);
            this.container.querySelector('.multiselect-status').textContent = this.getText(
                isSelected ? `${label}の選択を外しました` : `${label}を選択しました`,
                isSelected ? `${label} removed` : `${label} selected`
            );
        }
    }

    moveOptionFocus(key) {
        const options = Array.from(this.container.querySelectorAll('.multiselect-option'));
        if (options.length === 0) return;
        if (key === 'Home') this.activeOptionIndex = 0;
        else if (key === 'End') this.activeOptionIndex = options.length - 1;
        else {
            const delta = key === 'ArrowDown' ? 1 : -1;
            this.activeOptionIndex = (this.activeOptionIndex + delta + options.length) % options.length;
        }
        options[this.activeOptionIndex].focus();
    }

    attachEvents() {
        const wrapper = this.container.querySelector('.multiselect-wrapper');
        const input = wrapper.querySelector('.multiselect-input');
        const trigger = wrapper.querySelector('.multiselect-trigger');
        const tags = wrapper.querySelector('.multiselect-tags');
        const optionsList = wrapper.querySelector('.multiselect-options');

        input.addEventListener('click', event => {
            if (event.target.closest('.multiselect-remove')) return;
            const open = trigger.getAttribute('aria-expanded') !== 'true';
            this.setOpen(open);
        });

        trigger.addEventListener('keydown', event => {
            if (!['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Escape'].includes(event.key)) return;
            event.preventDefault();
            if (event.key === 'Escape') {
                this.setOpen(false);
                return;
            }
            this.setOpen(true, event.key === 'ArrowUp' ? 'last' : 'first');
        });

        optionsList.addEventListener('click', event => {
            const option = event.target.closest('.multiselect-option');
            if (!option) return;
            event.stopPropagation();
            this.activeOptionIndex = Array.from(optionsList.querySelectorAll('.multiselect-option')).indexOf(option);
            this.toggleValue(option.dataset.value);
            this.setOpen(true);
            wrapper.querySelectorAll('.multiselect-option')[this.activeOptionIndex]?.focus();
        });

        optionsList.addEventListener('keydown', event => {
            const option = event.target.closest('.multiselect-option');
            if (!option) return;
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                this.activeOptionIndex = Array.from(optionsList.querySelectorAll('.multiselect-option')).indexOf(option);
                this.moveOptionFocus(event.key);
            } else if (['Enter', ' '].includes(event.key)) {
                event.preventDefault();
                this.activeOptionIndex = Array.from(optionsList.querySelectorAll('.multiselect-option')).indexOf(option);
                this.toggleValue(option.dataset.value);
                this.setOpen(true);
                wrapper.querySelectorAll('.multiselect-option')[this.activeOptionIndex]?.focus();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.setOpen(false);
                trigger.focus();
            } else if (event.key === 'Tab') {
                this.setOpen(false);
            }
        });

        tags.addEventListener('click', event => {
            const remove = event.target.closest('.multiselect-remove');
            if (!remove) return;
            this.toggleValue(remove.dataset.value);
            event.stopPropagation();
        });

        document.addEventListener('click', event => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            if (!path.includes(wrapper) && !wrapper.contains(event.target)) this.setOpen(false);
        });

        this.handleLocaleChange = () => {
            if (!this.container.isConnected) {
                document.removeEventListener('easystat:localechange', this.handleLocaleChange);
                return;
            }
            this.updateTags();
            this.updateOptions();
        };
        document.addEventListener('easystat:localechange', this.handleLocaleChange);
    }

    getValue() {
        return [...this.selectedValues];
    }

    // プログラムから選択値をまとめて設定する（初学者モードの自動実行で使用）
    setValue(values) {
        const available = new Set(this.options.map(option => option.value));
        this.selectedValues = (values || []).map(String).filter(value => available.has(value));
        this.updateTags();
        this.updateOptions();
        this.onChange([...this.selectedValues]);
    }
}
