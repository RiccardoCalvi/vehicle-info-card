import { LitElement, html, TemplateResult, CSSResultGroup, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators';
import { repeat } from 'lit/directives/repeat';

import Sortable from 'sortablejs';

import { VehicleImage, VehicleCardConfig } from '../../types';
import { imageInputChange, handleFilePicked } from '../../utils/editor-image-handler';
import { fireEvent } from 'custom-card-helpers';
import { debounce } from 'es-toolkit';
import editorcss from '../../css/editor.css';

@customElement('panel-images')
export class PanelImages extends LitElement {
  @property({ type: Object }) editor!: any;
  @property({ type: Object }) config!: VehicleCardConfig;
  @property({ type: Array }) _images!: VehicleImage[];
  @state() _selectedItems: Set<string> = new Set();
  @state() _newImageUrl: string = '';
  @state() _sortable: Sortable | null = null;
  @state() _reindexImages: boolean = false;

  static get styles(): CSSResultGroup {
    return [editorcss];
  }

  protected shouldUpdate(_changedProperties: PropertyValues): boolean {
    if (_changedProperties.has('config')) {
      this._images = this.config.images;
      return true;
    }
    return true;
  }

  private _debouncedConfigChanged = debounce(this._configChanged.bind(this), 300);

  private _renderUploadAddNewImage(): TemplateResult {
    const errorMsg = this.editor.localize('card.common.toastImageError');

    const urlInput = html`
      <div class="custom-background-wrapper">
        <ha-button @click=${() => this.shadowRoot?.getElementById('file-upload-new')?.click()}>
          ${this.editor.hass.localize('ui.components.selectors.image.upload')}
        </ha-button>

        <input
          type="file"
          id="file-upload-new"
          class="file-input"
          .errorMsg=${errorMsg}
          .toastId="${`imagesConfig`}"
          @change=${(ev: any) => handleFilePicked(this.editor, ev)}
          accept="image/*"
          multiple
        />
        <ha-textfield
          .label=${this.editor.hass.localize('ui.components.selectors.image.url')}
          .configValue=${'new_image_url'}
          .value=${this._newImageUrl}
          @input=${this.toggleAddButton}
        ></ha-textfield>
        <div class="new-url-btn">
          <ha-icon icon="mdi:plus" @click=${() => this.addNewImageUrl()}></ha-icon>
        </div>
      </div>
    `;
    return urlInput;
  }

  private _imageList(): TemplateResult {
    if (this._reindexImages) {
      return html`<span>Loading...</span>`;
    }

    const imageList = html`<div class="images-list" id="images-list">
      ${repeat(
        this._images || [],
        (image) => image.url,
        (image, index) =>
          html`<div class="custom-background-wrapper" data-url="${image.url}">
            <div class="handle"><ha-icon icon="mdi:drag"></ha-icon></div>
            <ha-textfield
              class="image-input"
              .label=${'IMAGE URL'}
              .configValue=${'images'}
              .value=${image.title}
              @input=${(event: Event) => imageInputChange(this.editor, event, index)}
            ></ha-textfield>
            <ha-checkbox .checked=${false} @change=${(ev: Event) => this._toggleSelection(ev, image.url)}></ha-checkbox>
          </div>`
      )}
    </div> `;
    return imageList;
  }

  protected render(): TemplateResult {
    const selectAction = {
      label:
        this._selectedItems.size === 0
          ? this.editor.localize('editor.imagesConfig.selectAll')
          : this.editor.localize('editor.imagesConfig.deselectAll'),
      action: this._selectedItems.size === 0 ? this._selectAll : this._deselectAllItems,
    };

    const deleteButton =
      this._selectedItems.size > 0
        ? html`
            <ha-button @click=${this._deleteSelectedItems}>
              ${this.editor.localize('editor.imagesConfig.deleteSelected')}
            </ha-button>
          `
        : '';

    const showIndexDeleteBtn =
      this.config.images && this.config.images.length > 0
        ? html`
            <div class="custom-background-wrapper">
              <ha-formfield .label=${'Show Image Index'}>
                <ha-checkbox
                  .checked=${this.config.show_image_index !== false}
                  .configValue=${'show_image_index'}
                  @change=${(ev: Event) => this.editor._valueChanged(ev)}
                ></ha-checkbox>
              </ha-formfield>
              <ha-button @click=${selectAction.action}>${selectAction.label}</ha-button>
              ${deleteButton}
            </div>
          `
        : '';
    const addNewImage = this._renderUploadAddNewImage();
    const imageList = this._imageList();

    const content = html`${imageList}${showIndexDeleteBtn}${addNewImage}`;

    return content;
  }

  private _configChanged(): void {
    fireEvent(this.editor, 'config-changed', { config: this.config });
  }

  public initSortable() {
    this.updateComplete.then(() => {
      const el = this.shadowRoot?.getElementById('images-list');
      if (el) {
        this._sortable = new Sortable(el, {
          handle: '.handle',
          animation: 150,
          ghostClass: 'ghost',
          onEnd: (evt) => {
            this._handleSortEnd(evt);
          },
        });
        console.log('Sortable initialized');
      }
    });
  }

  private _handleSortEnd(evt: any) {
    evt.preventDefault();
    const oldIndex = evt.oldIndex;
    const newIndex = evt.newIndex;

    if (oldIndex !== newIndex) {
      this._reorderImages(oldIndex, newIndex);
    }
  }

  private _reorderImages(oldIndex: number, newIndex: number) {
    const configImages = this._images.concat();
    const movedItem = configImages.splice(oldIndex, 1)[0];
    configImages.splice(newIndex, 0, movedItem);
    this.config = { ...this.config, images: configImages };
    this._debouncedConfigChanged();
  }

  private _toggleSelection(event: Event, url: string): void {
    event.stopPropagation();
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this._selectedItems.add(url);
      this.requestUpdate();
    } else {
      this._selectedItems.delete(url);
      this.requestUpdate();
    }
  }

  private _deselectAllItems(): void {
    const checkboxes = this.shadowRoot?.querySelectorAll('.images-list ha-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });

    this._selectedItems.clear(); // Clear all selections
    this.requestUpdate();
  }

  private _selectAll(): void {
    const checkboxes = this.shadowRoot?.querySelectorAll('.images-list ha-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((checkbox) => {
      checkbox.checked = true;
    });

    this._selectedItems.clear(); // Clear existing selections
    this.config.images.forEach((image: { url: string }) => this._selectedItems.add(image.url));

    this.requestUpdate();
  }

  private _deleteSelectedItems(): void {
    if (this._selectedItems.size === 0) return;
    const images = this.config.images.filter((image: { url: string }) => !this._selectedItems.has(image.url));
    this._selectedItems.clear();
    fireEvent(this.editor, 'config-changed', { config: { ...this.config, images } });
    this.validateImageList();
  }

  private validateImageList(): void {
    setTimeout(() => {
      const imagesListCount = this.shadowRoot?.querySelectorAll('.images-list .image-input').length || 0;
      const configImagesCount = this.config.images.length;
      if (imagesListCount !== configImagesCount) {
        console.log('Reindexing images  ...');
        this._reindexImages = true;
        setTimeout(() => {
          this._reindexImages = false;
          this.requestUpdate();
          this.initSortable();
        }, 300);
      } else {
        return;
      }
    }, 200);
  }

  private toggleAddButton(ev: Event): void {
    ev.stopPropagation();
    const target = ev.target as HTMLInputElement;
    const addButton = target.parentElement?.querySelector('.new-url-btn') as HTMLElement;
    if (!addButton) return;
    if (target.value && target.value.length > 0) {
      this._newImageUrl = target.value;
      addButton.classList.add('show');
    } else {
      addButton.classList.remove('show');
    }
  }
  private addNewImageUrl(): void {
    if (!this._newImageUrl || !this.config) return;
    const images = [...this.config.images];
    images.push({ url: this._newImageUrl, title: this._newImageUrl });
    this.config = { ...this.config, images };
    this._newImageUrl = '';
    this._debouncedConfigChanged();
  }
}
