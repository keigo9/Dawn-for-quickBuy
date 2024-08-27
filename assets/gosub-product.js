/* eslint-disable */
var GoSubWidget = (function () {
  function GoSubWidget() {
    this.attrs = {
      purchaseOptionOneTime: "data-gosub-purchase-option-one-time",
      sellingPlanGroupId: "data-gosub-selling-plan-group-id",

      sellingPlanIdInput: "data-gosub-selling-plan-id-input",

      widget: "data-gosub-product",
      sellingPlanOptionsContainer: "data-gosub-selling-plan-options-container",
      sellingPlanOption: "data-gosub-selling-plan-option",
      sellingPlansContainer: "data-gosub-selling-plans-container",
      sellingPlanGroup: "data-gosub-selling-plan-group",
      sellingPlanGroupInput: "data-gosub-selling-plan-group-input",
      sellingPlan: "data-gosub-selling-plan",
      sellingPlanInput: "data-gosub-selling-plan-input",
      productJson: "data-gosub-product-json",
      groupDiscountSummary: "data-gosub-group-discount-summary",
      perDeliveryPrice: "data-gosub-per-delivery-price",
      cartPopupDetails: "data-gosub-cart-popup-details",
      cartPageDetails: "data-gosub-cart-page-details",
      moneyFormat: "data-gosub-money-format",
      pageTemplate: "data-gosub-page-template",
    };

    this.selectors = {
      productForm: 'form[action*="/cart/add"]',
      variantIdInput: '[name="id"]',
      variantSelector: [
        "#shappify-variant-id",
        ".single-option-selector",
        "select[name=id]",
        "input[name=id]",
      ],
      sellingPlanGroupButton: ".gosub-widget__group",
    };
    // autogenerate selectors from attributes
    Object.entries(this.attrs).forEach(
      function ([key, value]) {
        this.selectors[key] = `[${value}]`;
      }.bind(this)
    );

    this.classes = {
      hidden: "gosub__hidden",
      selected: "gosub__plan-selected",
    };

    this.products = {};
    this.variants = {};
    this.sellingPlanGroups = {};
    this.pageTemplate = "";
  }

  GoSubWidget.prototype = Object.assign({}, GoSubWidget.prototype, {
    init: function () {
      console.debug("GORIDE SUBSCRIPTION LOADING...");
      if (!document.querySelector(this.selectors.widget)) {
        console.debug("GORIDE SUB SKIPPED LOADING");
        return;
      }
      this._parsePageTemplate();
      this._parseProductJson();
      this._addVariantChangeListener();

      var widgets = document.querySelectorAll(this.selectors.widget);
      widgets.forEach(
        function (widget) {
          this._renderPrices(widget);
          // this._renderGroupDiscountSummary(widget)
        }.bind(this)
      );

      window.addEventListener(
        "pageshow",
        function () {
          this.syncAllVisuallySelected();
        }.bind(this)
      );

      console.debug("GORIDE SUBSCRIPTION LOAD SUCCESSFUL");
    },

    /**
     * Set the hidden selling_plan input to the visually selected plan in the widget.
     * The browser caches form state between back and forward navigations, but doesn't emit change events.
     */
    syncAllVisuallySelected: function () {
      var widgets = document.querySelectorAll(this.selectors.widget);
      widgets.forEach(this._syncVisuallySelected.bind(this));
    },

    _syncVisuallySelected: function (widget) {
      var selectedGroupEl = widget.querySelector(
        `${this.selectors.sellingPlanGroupInput}:checked`
      );
      selectedGroupEl.dispatchEvent(new Event("change"));
    },

    _addVariantChangeListener: function () {
      var selectors = document.querySelectorAll(
        this.selectors.variantSelector.join()
      );
      selectors.forEach(
        function (select) {
          if (select) {
            select.addEventListener(
              "change",
              function (event) {
                var productForm = event.target.closest(
                  this.selectors.productForm
                );
                if (!productForm) console.log("product form not found");
                var widget = productForm?.querySelector(this.selectors.widget);

                // NOTE: Variant change event needs to propagate to `input[name=id]`, so wait for that to happen...
                setTimeout(
                  function () {
                    this._renderPrices(widget);
                    // this._renderGroupDiscountSummary(widget)
                  }.bind(this),
                  100
                );
              }.bind(this)
            );
          }
        }.bind(this)
      );
    },

    _parsePageTemplate: function () {
      var pageTemplateInputEl = document.querySelector(
        this.selectors.pageTemplate
      );
      if (pageTemplateInputEl === null) {
        return;
      }
      this.pageTemplate = pageTemplateInputEl.value;
    },

    _parseProductJson: function () {
      var productJsonElements = document.querySelectorAll(
        this.selectors.productJson
      );

      productJsonElements.forEach(
        function (element) {
          var productJson = JSON.parse(element.innerHTML);
          this.products[element.dataset.gosubProductId] = productJson;

          productJson.selling_plan_groups.forEach(
            function (sellingPlanGroup) {
              this.sellingPlanGroups[sellingPlanGroup.id] = sellingPlanGroup;
            }.bind(this)
          );

          productJson.variants.forEach(
            function (variant) {
              this.variants[variant.id] = variant;
            }.bind(this)
          );
        }.bind(this)
      );
    },

    renderAllPrices: function () {
      console.log("widgets renderAllPrices");
      //console.log(widgets);
      var widgets = document.querySelectorAll(this.selectors.widget);
      widgets.forEach(this._renderPrices.bind(this));
    },

    /**
     * Display "price / delivery" for each plan label.
     * Should run again if variant changes.
     */
    _renderPrices: function (widget) {
      // Check, product.selling_plan_groups.size > 1
      const isMultiGroup = document
        .querySelector("div.gosub-widget__wrapper")
        .classList.contains("gosub-widget__wrapper--multi-group");
      // console.log(`multigroup: ${isMultiGroup}`);
      if (typeof widget === "undefined" || widget === null) {
        widget = document.querySelector(this.selectors.widget);
      }
      var planRadioEls = widget.querySelectorAll(this.selectors.sellingPlan);
      var variantId = this._getVariantId(widget);
      if (variantId) {
        planRadioEls.forEach(
          function (element) {
            var sellingPlanId = element.dataset.gosubSellingPlanId;
            var sellingPlanAllocation = this._getSellingPlanAllocation(
              variantId,
              sellingPlanId
            );
            // console.log(variantId);
            // console.log(sellingPlanId);
            // console.log(sellingPlanAllocation);
            // sets prices & hides the subscription option if it is not available for some variants.
            var subscriptionOption = document.getElementsByClassName(
              "gosub-widget__group"
            )[1];
            var subscriptionList = document.getElementsByClassName(
              "gosub-widget__plans-container"
            )[0];
            var priceEl = element.querySelector(
              this.selectors.perDeliveryPrice
            );
            if (sellingPlanAllocation != undefined) {
              // varinatにsubscriptionが割り当てられているoption
              if (isMultiGroup) {
                element.classList.remove(this.classes.hidden);
              } else {
                if (subscriptionOption != undefined) {
                  subscriptionOption.classList.remove(this.classes.hidden);
                  subscriptionList.classList.remove(this.classes.hidden);
                }
              }
              var price = sellingPlanAllocation.per_delivery_price;
              var formattedPrice = this._formatPrice(price);
              priceEl.innerHTML = formattedPrice;
            } else {
              // varinatにsubscriptionが割り当てられてないoption
              if (isMultiGroup) {
                element.classList.add(this.classes.hidden);
              } else {
                subscriptionOption.classList.add(this.classes.hidden);
              }
              //document.querySelectorAll("input[value=once]")[0]?.click();
              subscriptionList.classList.add(this.classes.hidden);
            }
          }.bind(this)
        );
        if (isMultiGroup) {
          const allOptions = document.querySelectorAll(
            ".gosub-widget__plans-container"
          );
          const gosubBlock = document.querySelector("fieldset.gosub-product");
          const subscriptionButton = document.querySelector(
            ".gosub-widget__groups-container .gosub-widget__group:last-child"
          );
          gosubBlock.classList.remove("gosub__hidden");
          subscriptionButton.classList.remove("gosub__hidden");
          if (
            document
              .querySelector(".gosub-widget__groups-container")
              .classList.contains("default-subscription-selected")
          ) {
            document.querySelectorAll("input[value=subscription]")[0]?.click();
          }
          for (const option of allOptions) {
            option.classList.remove("gosub__hidden");
          }
          // if no active option in group, hide group.
          const planGrups = document.querySelectorAll(
            ".gosub-widget__plans-container.gosub-widget__plans-container__multiple"
          );
          for (const group of planGrups) {
            const activeOption = group.querySelector(
              ".gosub-widget__plan:not(.gosub__hidden)"
            );
            if (!activeOption) {
              //console.log("active option is null");
              group.classList.add("gosub__hidden");
            }
          }
          const activeplanGrup = document.querySelector(
            ".gosub-widget__plans-container.gosub-widget__plans-container__multiple:not(.gosub__hidden)"
          );
          if (!activeplanGrup) {
            //console.log("subscription plan is null in this variant, so hide select buttons");
            gosubBlock.classList.add("gosub__hidden");
            subscriptionButton.classList.add("gosub__hidden");
            document.querySelectorAll("input[value=once]")[0]?.click();
          }
          // set sellingPlan searchParms
          const groupSelectedId =
            document
              .querySelector("input[data-gosub-selling-plan-input]:checked")
              ?.closest(".gosub-widget__plans-container") ||
            document.querySelector(".gosub-widget__plans-container");
          const groupId = groupSelectedId.dataset.gosubSellingPlanGroupId;
          const buyMethod = document.querySelector(
            ".gosub-widget__group.gosub__plan-selected input"
          ).value;
          const sellingPlanId =
            buyMethod === "once"
              ? ""
              : this._getActiveSellingPlanId(widget, groupId);
          this._setSellingPlanIdInput(widget, sellingPlanId);
        } else {
          const gosubBlock = document.querySelector("fieldset.gosub-product");
          const subscriptionButton = document.querySelector(
            ".gosub-widget__groups-container .gosub-widget__group:last-child"
          );
          gosubBlock.classList.remove("gosub__hidden");
          if (
            document
              .querySelector(".gosub-widget__groups-container")
              .classList.contains("default-subscription-selected")
          ) {
            document.getElementById("inputSubscription")?.click();
          }
          if (subscriptionButton.classList.contains("gosub__hidden")) {
            console.log(
              "subscription plan is null in this variant, so hide select buttons"
            );
            gosubBlock.classList.add("gosub__hidden");
            document.querySelectorAll("input[value=once]")[0]?.click();
          }
          // set sellingPlan searchParms
          const groupId = document.querySelector(
            ".gosub-widget__group.gosub__plan-selected input"
          ).value;
          const sellingPlanId =
            groupId === "once"
              ? ""
              : this._getActiveSellingPlanId(widget, groupId);
          this._setSellingPlanIdInput(widget, sellingPlanId);
        }

        // discount description change
        const discountDescriptions = document.querySelectorAll(
          ".gosub-discount-descriptions-container div"
        );
        discountDescriptions.forEach((description) => {
          description.classList.add("gosub__hidden");
        });
        const currentPlansContainer = document
          .querySelector(".gosub-widget__plan-label.active")
          .closest(".gosub-widget__plans-container");
        const currentWidget = document
          .querySelector(".gosub-widget__plan-label.active")
          .closest(".gosub-widget__plan");
        // console.log(currentPlansContainer);
        // console.log(currentWidget);
        const currentCycle = currentWidget.dataset.gosubSellingPlanCycle;
        const currentName = currentWidget.dataset.gosubSellingPlanName;
        const activeDiscountDescription = currentPlansContainer.querySelector(
          `div[data-gosub-plan-cycle="${currentCycle}"][data-gosub-plan-name="${currentName}"]`
        );
        if (activeDiscountDescription) {
          activeDiscountDescription.classList.remove("gosub__hidden");
        }
      }
    },

    handleSellingPlanGroupChange: function (event) {
      var groupRadioEl = event.target;
      var groupId = groupRadioEl.value;
      var widget = groupRadioEl.closest(this.selectors.widget);

      var plansGroupButtons = widget.querySelectorAll(
        this.selectors.sellingPlanGroupButton
      );
      var plansContainers = widget.querySelectorAll(
        this.selectors.sellingPlansContainer
      );

      plansGroupButtons.forEach(
        function (plansGroupButton) {
          if (
            plansGroupButton.querySelector(this.selectors.sellingPlanGroupInput)
              .checked
          ) {
            plansGroupButton.classList.add(this.classes.selected);
          } else {
            plansGroupButton.classList.remove(this.classes.selected);
          }
        }.bind(this)
      );

      plansContainers.forEach(
        function (plansContainer) {
          var plansContainerGroupId =
            plansContainer.dataset.gosubSellingPlanGroupId;
          //console.log(plansContainerGroupId);
          if (plansContainerGroupId === groupId && groupRadioEl.checked) {
            plansContainer.classList.remove(this.classes.hidden);
          } else {
            plansContainer.classList.add(this.classes.hidden);
          }
        }.bind(this)
      );

      // discount description change
      const discountDescriptions = document.querySelectorAll(
        ".gosub-discount-descriptions-container div"
      );
      discountDescriptions.forEach((description) => {
        description.classList.add("gosub__hidden");
      });
      const currentPlansContainer = document
        .querySelector(".gosub-widget__plan-label.active")
        .closest(".gosub-widget__plans-container");
      const currentWidget = document
        .querySelector(".gosub-widget__plan-label.active")
        .closest(".gosub-widget__plan");
      const currentCycle = currentWidget.dataset.gosubSellingPlanCycle;
      const currentName = currentWidget.dataset.gosubSellingPlanName;
      const activeDiscountDescription = currentPlansContainer.querySelector(
        `div[data-gosub-plan-cycle="${currentCycle}"][data-gosub-plan-name="${currentName}"]`
      );
      if (activeDiscountDescription) {
        activeDiscountDescription.classList.remove("gosub__hidden");
      }

      if (groupId === "once") {
        this._setSellingPlanIdInput(widget, "");
        return;
      }

      // TODO: Implement setting for plan options vs. plan list
      // var selectedOptions = this._getSellingPlanOptions(groupId);
      // var sellingPlan = this._getSellingPlanFromOptions(groupId, selectedOptions);

      var sellingPlanId = this._getActiveSellingPlanId(widget, groupId);
      this._setSellingPlanIdInput(widget, sellingPlanId);
    },

    handleSellingPlanGroupChangeMultipleGroup: function (event) {
      const groupSelectedId =
        document
          .querySelector("input[data-gosub-selling-plan-input]:checked")
          ?.closest(".gosub-widget__plans-container") ||
        document.querySelector(".gosub-widget__plans-container");
      const groupId = groupSelectedId.dataset.gosubSellingPlanGroupId;
      var groupRadioEl = event.target;
      var buyMethod = groupRadioEl.value;
      var widget = groupRadioEl.closest(this.selectors.widget);

      var plansGroupButtons = widget.querySelectorAll(
        this.selectors.sellingPlanGroupButton
      );
      const plansContainer = document.getElementById(
        "gosub-widget__plans-container-wrapper"
      );

      plansGroupButtons.forEach(
        function (plansGroupButton) {
          if (
            plansGroupButton.querySelector(this.selectors.sellingPlanGroupInput)
              .checked
          ) {
            plansGroupButton.classList.add(this.classes.selected);
          } else {
            plansGroupButton.classList.remove(this.classes.selected);
          }
        }.bind(this)
      );

      // discount description change
      const discountDescriptions = document.querySelectorAll(
        ".gosub-discount-descriptions-container div"
      );
      discountDescriptions.forEach((description) => {
        description.classList.add("gosub__hidden");
      });
      const currentPlansContainer = document
        .querySelector(".gosub-widget__plan-label.active")
        .closest(".gosub-widget__plans-container");
      const currentWidget = document
        .querySelector(".gosub-widget__plan-label.active")
        .closest(".gosub-widget__plan");
      const currentCycle = currentWidget.dataset.gosubSellingPlanCycle;
      const currentName = currentWidget.dataset.gosubSellingPlanName;
      const activeDiscountDescription = currentPlansContainer.querySelector(
        `div[data-gosub-plan-cycle="${currentCycle}"][data-gosub-plan-name="${currentName}"]`
      );
      if (activeDiscountDescription) {
        activeDiscountDescription.classList.remove("gosub__hidden");
      }

      if (buyMethod === "subscription") {
        plansContainer.classList.remove(this.classes.hidden);
      } else {
        plansContainer.classList.add(this.classes.hidden);
      }

      if (buyMethod === "once") {
        this._setSellingPlanIdInput(widget, "");
        return;
      }

      // TODO: Implement setting for plan options vs. plan list
      // var selectedOptions = this._getSellingPlanOptions(groupId);
      // var sellingPlan = this._getSellingPlanFromOptions(groupId, selectedOptions);

      var sellingPlanId = this._getActiveSellingPlanId(widget, groupId);
      this._setSellingPlanIdInput(widget, sellingPlanId);
    },

    handleSellingPlanChange: function (event) {
      var planRadioEl = event.target;
      var widget = planRadioEl.closest(this.selectors.widget);
      this._setSellingPlanIdInput(widget, planRadioEl.value);
      var labels = document.getElementsByClassName("gosub-widget__plan-label");
      for (var i = 0; i < labels.length; i++) {
        var btns = labels[i];
        btns.classList.remove("active");
      }
      planRadioEl.parentNode.classList.add("active");

      // discount description change
      const discountDescriptions = document.querySelectorAll(
        ".gosub-discount-descriptions-container div"
      );
      discountDescriptions.forEach((description) => {
        description.classList.add("gosub__hidden");
      });
      const currentPlansContainer = planRadioEl.closest(
        ".gosub-widget__plans-container"
      );
      const currentWidget = planRadioEl.closest(".gosub-widget__plan");
      const currentCycle = currentWidget.dataset.gosubSellingPlanCycle;
      const currentName = currentWidget.dataset.gosubSellingPlanName;
      const activeDiscountDescription = currentPlansContainer.querySelector(
        `div[data-gosub-plan-cycle="${currentCycle}"][data-gosub-plan-name="${currentName}"]`
      );
      if (activeDiscountDescription) {
        activeDiscountDescription.classList.remove("gosub__hidden");
      }
    },

    handleSellingPlanChangeMultipleGroup: function (event) {
      var planRadioEl = event.target;
      if (planRadioEl.checked === true) {
        var widget = planRadioEl.closest(this.selectors.widget);
        this._setSellingPlanIdInput(widget, planRadioEl.value);
        var labels = document.getElementsByClassName(
          "gosub-widget__plan-label"
        );
        for (var i = 0; i < labels.length; i++) {
          var btns = labels[i];
          btns.classList.remove("active");
        }
        planRadioEl.parentNode.classList.add("active");
        // remove checked, if other radio is checked
        const currentPlansContainer = planRadioEl.closest(
          ".gosub-widget__plans-container.gosub-widget__plans-container__multiple"
        );
        const plansContainer = document.querySelectorAll(
          ".gosub-widget__plans-container.gosub-widget__plans-container__multiple"
        );
        plansContainer.forEach((plan) => {
          if (currentPlansContainer !== plan) {
            const otherCheckedRadio = plan.querySelector("input:checked");
            if (otherCheckedRadio) {
              otherCheckedRadio.checked = false;
            }
          }
        });

        // discount description change
        const discountDescriptions = document.querySelectorAll(
          ".gosub-discount-descriptions-container div"
        );
        discountDescriptions.forEach((description) => {
          description.classList.add("gosub__hidden");
        });
        const currentWidget = planRadioEl.closest(".gosub-widget__plan");
        const currentCycle = currentWidget.dataset.gosubSellingPlanCycle;
        const currentName = currentWidget.dataset.gosubSellingPlanName;
        const activeDiscountDescription = currentPlansContainer.querySelector(
          `div[data-gosub-plan-cycle="${currentCycle}"][data-gosub-plan-name="${currentName}"]`
        );
        if (activeDiscountDescription) {
          activeDiscountDescription.classList.remove("gosub__hidden");
        }
      }
    },

    // NOTE: Selling Plan Options not supported in the current version of the widget...
    handleSellingPlanOptionChange: function (event) {
      var widget = event.target.closest(this.selectors.widget);

      var sellingPlanGroupId = event.target.dataset.gosubSellingPlanGroupId;
      var selectedOptions = this._getSellingPlanOptions(
        widget,
        sellingPlanGroupId
      );
      var sellingPlan = this._getSellingPlanFromOptions(
        sellingPlanGroupId,
        selectedOptions
      );
      this._setSellingPlanIdInput(sellingPlan.id);
    },

    _setSellingPlanIdInput: function (widget, sellingPlanId) {
      // console.log(widget);
      // console.log("sellingPlanId");
      // console.log(sellingPlanId);
      // create hidden input with selling plan inside product form. This input is what provides the weekly/monthly etc selling plan data to the cart
      const targetForm = findClosestElement(
        widget,
        "form[action*='/cart/add']"
      );
      if (!targetForm) {
        console.error(
          "gosub: Could not find target form at setSellingPlanIdInput"
        );
      }
      const sellingPlanIdInput = targetForm.querySelector(".SellingPlanInput");
      if (!sellingPlanIdInput) {
        console.log("there is no input yet");
        var subscInput = document.createElement("input");
        subscInput.type = "hidden";
        subscInput.name = "selling_plan";
        subscInput.value = sellingPlanId;
        subscInput.classList.add("SellingPlanInput");
        subscInput.setAttribute("data-gosub-selling-plan-id-input", "");
        targetForm.prepend(subscInput);
      } else {
        //console.log("there is already an input");
        sellingPlanIdInput.value = sellingPlanId;
      }
      var variantId = this._getVariantId(widget);

      if (
        /.*(product).*/.test(this.pageTemplate) ||
        /.*(collections).*/.test(this.pageTemplate)
      ) {
        this._updateHistoryState(variantId, sellingPlanId);
      }
    },

    _getSellingPlanGroup: function (groupId) {
      if (!this.sellingPlanGroups[groupId]) {
        console.error("gosub: Selling plan group data not found.");
        return;
      }

      return this.sellingPlanGroups[groupId];
    },

    // NOTE: Selling Plan Options not supported in the current version of the widget...
    _getSellingPlanOptions: function (widget, sellingPlanGroupId) {
      var sellingPlanOptions = widget.querySelectorAll(
        `${this.selectors.sellingPlanOption}[${this.attrs.sellingPlanGroupId}="${sellingPlanGroupId}"]:checked`
      );

      var selectedOptions = [];
      sellingPlanOptions.forEach(function (optionElement) {
        selectedOptions.push({
          index: optionElement.dataset.gosubOptionIndex,
          value: optionElement.value,
        });
      });

      return selectedOptions;
    },

    // NOTE: Selling Plan Options not supported in the current version of the widget...
    _getSellingPlanFromOptions: function (groupId, selectedOptions) {
      var sellingPlans = this._getSellingPlanGroup(groupId).selling_plans;

      var planFromOptions = sellingPlans.find(function (plan) {
        return selectedOptions.every(function (option) {
          return plan.options[option.index].value === option.value;
        });
      });

      return planFromOptions;
    },

    _getVariantId: function (widget) {
      var productForm = findClosestElement(widget, "form[action*='/cart/add']");
      if (!productForm) {
        console.error("gosub: Could not find product form at getVariantId.");
      }

      var variantIdInput = productForm.querySelector(
        this.selectors.variantIdInput
      );

      return variantIdInput.value;
    },

    _getActiveSellingPlanId: function (widget, groupId) {
      var activePlanInputEl = widget.querySelector(
        `input[name=gosub-selling-plan-${groupId}]:checked`
      );

      if (!activePlanInputEl) {
        console.error(
          `gosub: Could not find active plan ID for group ${groupId}.`
        );
      }

      return activePlanInputEl.value;
    },

    _updateHistoryState: function (variantId, sellingPlanId) {
      if (!history.replaceState || !variantId) {
        return;
      }

      var newurl =
        window.location.protocol +
        "//" +
        window.location.host +
        window.location.pathname +
        "?";

      if (sellingPlanId) {
        newurl += "selling_plan=" + sellingPlanId + "&";
      }

      newurl += "variant=" + variantId;

      window.history.replaceState({ path: newurl }, "", newurl);
    },

    /**
     * SellingPlanAllocation is the the information of how a selling plan applies to a
     * specific variant.
     */
    _getSellingPlanAllocation(variantId, sellingPlanId) {
      var variant = this.variants[variantId];
      if (!variant) {
        console.error(`gosub: Could not find variant ID ${variantId}`);
        return null;
      }
      return variant.selling_plan_allocations.find(function (plan) {
        return `${plan.selling_plan_id}` === sellingPlanId;
      });
    },

    _formatPrice(cents, format) {
      var moneyElement = document.querySelector(this.selectors.moneyFormat);
      var moneyFormat = moneyElement
        ? moneyElement.getAttribute("data-gosub-money-format")
        : null;

      if (typeof cents === "string") {
        cents = cents.replace(".", "");
      }

      var value = "";
      var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
      var formatString =
        format ||
        moneyFormat ||
        theme.moneyFormat ||
        theme.strings.moneyFormat ||
        Shopify.money_format ||
        "$ {% raw %}{{ amount }}{% endraw %}";

      function formatWithDelimiters(number, precision, thousands, decimal) {
        thousands = thousands || ",";
        decimal = decimal || ".";

        if (isNaN(number) || number === null) {
          return 0;
        }

        number = (number / 100.0).toFixed(precision);

        var parts = number.split(".");
        var dollarsAmount = parts[0].replace(
          /(\d)(?=(\d\d\d)+(?!\d))/g,
          "$1" + thousands
        );
        var centsAmount = parts[1] ? decimal + parts[1] : "";

        return dollarsAmount + centsAmount;
      }

      switch (formatString.match(placeholderRegex)[1]) {
        case "amount":
          value = formatWithDelimiters(cents, 2);
          break;
        case "amount_no_decimals":
          value = formatWithDelimiters(cents, 0);
          break;
        case "amount_with_comma_separator":
          value = formatWithDelimiters(cents, 2, ".", ",");
          break;
        case "amount_no_decimals_with_comma_separator":
          value = formatWithDelimiters(cents, 0, ".", ",");
          break;
        case "amount_no_decimals_with_space_separator":
          value = formatWithDelimiters(cents, 0, " ");
          break;
        case "amount_with_apostrophe_separator":
          value = formatWithDelimiters(cents, 2, "'");
          break;
      }

      return formatString.replace(placeholderRegex, value);
    },
  });

  return GoSubWidget;
})();

document.addEventListener("DOMContentLoaded", function () {
  window.GORIDE = window.GORIDE || {};
  window.GORIDE.GoSubWidget = new GoSubWidget();
  window.GORIDE.GoSubWidget.init();
});

function findClosestElement(element, targetQuery) {
  // まず、element自体とその祖先要素の中から探す
  let closest = element.closest(targetQuery);
  if (closest) return closest;

  // 見つからなかった場合、documentのルートから探す
  const allElements = document.querySelectorAll(targetQuery);
  if (allElements.length === 0) return null;

  // elementからの相対的な位置を計算して最も近い要素を見つける
  let nearestElement = null;
  let nearestDistance = 6;

  allElements.forEach((targetElement) => {
    // elementとtargetElementの位置関係を取得
    const position = element.compareDocumentPosition(targetElement);

    // 要素間の距離を計算（この方法は簡略化されています）
    let distance;
    if (position & Node.DOCUMENT_POSITION_CONTAINED_BY) {
      // targetElementがelementの子孫の場合
      distance = 0;
    } else if (position & Node.DOCUMENT_POSITION_CONTAINS) {
      // targetElementがelementの祖先の場合
      distance = 1;
    } else if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
      // targetElementがelementの後に来る場合
      distance = 3;
    } else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
      // targetElementがelementの前に来る場合
      distance = 4;
    } else {
      // その他の場合（最も遠い）
      distance = 5;
    }

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestElement = targetElement;
    }
  });

  return nearestElement;
}
