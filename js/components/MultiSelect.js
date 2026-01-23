export class MultiSelect {
    constructor(containerId, options, config = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = options; // Array of strings or objects {label, value}
        this.selectedValues = config.defaultSelected || [];
        this.placeholder = config.placeholder || '選択してください...';
        this.onChange = config.onChange || (() => { });
        this.id = 'ms-' + Math.random().toString(36).substr(2, 9);

        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="multiselect-wrapper" id="${this.id}">
                <div class="multiselect-input" tabindex="0">
                    <div class="multiselect-tags"></div>
                    <input type="text" class="multiselect-search" placeholder="${this.selectedValues.length === 0 ? this.placeholder : ''}" readonly>
                    <i class="fas fa-chevron-down multiselect-chevron"></i>
                </div>
                <div class="multiselect-dropdown" style="display: none;">
                    <ul class="multiselect-options"></ul>
                </div>
            </div>
        `;
        this.updateTags();
        this.updateOptions();
    }

    updateTags() {
        const tagsContainer = this.container.querySelector('.multiselect-tags');
        tagsContainer.innerHTML = '';

        this.selectedValues.forEach(val => {
            const tag = document.createElement('span');
            tag.className = 'multiselect-tag';
            tag.innerHTML = `
                ${val}
                <i class="fas fa-times" data-value="${val}"></i>
            `;
            tagsContainer.appendChild(tag);
        });

        // Update placeholder visibility
        const input = this.container.querySelector('.multiselect-search');
        if (this.selectedValues.length > 0) {
            input.placeholder = '';
            input.style.width = '20px'; // Minimize width but keep focusable
        } else {
            input.placeholder = this.placeholder;
            input.style.width = '100%';
        }
    }

    updateOptions() {
        const list = this.container.querySelector('.multiselect-options');
        list.innerHTML = '';

        const availableOptions = this.options.filter(opt => !this.selectedValues.includes(opt));

        if (availableOptions.length === 0) {
            list.innerHTML = '<li class="no-options">選択可能な項目はありません</li>';
            return;
        }

        availableOptions.forEach(opt => {
            const li = document.createElement('li');
            li.textContent = opt;
            li.dataset.value = opt;
            list.appendChild(li);
        });
    }

    attachEvents() {
        const wrapper = document.getElementById(this.id);
        const inputDiv = wrapper.querySelector('.multiselect-input');
        const dropdown = wrapper.querySelector('.multiselect-dropdown');
        const tagsContainer = wrapper.querySelector('.multiselect-tags');
        const optionsList = wrapper.querySelector('.multiselect-options');

        // Toggle dropdown
        inputDiv.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) return; // Ignore tag close clicks
            wrapper.classList.toggle('active');
            dropdown.style.display = wrapper.classList.contains('active') ? 'block' : 'none';
        });

        // Select option
        optionsList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li || li.classList.contains('no-options')) return;

            const value = li.dataset.value;
            this.selectedValues.push(value);
            this.updateTags();
            this.updateOptions();
            this.onChange(this.selectedValues);
            e.stopPropagation();

            // Keep dropdown open for multiple selection or close? Streamlit usually keeps it or requires reopen.
            // Let's keep it open for convenience but clear search if we implemented it.
            // wrapper.classList.remove('active');
            // dropdown.style.display = 'none';
        });

        // Remove tag
        tagsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('fa-times')) {
                const value = e.target.dataset.value;
                this.selectedValues = this.selectedValues.filter(v => v !== value);
                this.updateTags();
                this.updateOptions();
                this.onChange(this.selectedValues);
                e.stopPropagation(); // Prevent dropdown toggle
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                wrapper.classList.remove('active');
                dropdown.style.display = 'none';
            }
        });
    }

    getValue() {
        return this.selectedValues;
    }
}
