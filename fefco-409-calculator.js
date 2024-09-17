// Pricing Variables
const VAT_RATE = 21; // VAT percentage
const GLOBAL_FACTOR = 1.12; // Global pricing factor (from data-global-factor)
const LOCAL_FACTOR = 1; // Local pricing factor (from data-local-factor)
const BASE_SURCHARGE = 0.20; // Base surcharge per unit
const QUANTITY_SURCHARGE = 25; // Additional surcharge divided by quantity
const ADDITIONAL_FACTOR = 1.05; // Additional pricing factor

// Profit margins based on quantity
const PROFIT_MARGIN_SMALL = 0.52; // For quantity < 251
const PROFIT_MARGIN_LARGE = 0.56; // For quantity > 250

// Surface factors based on total surface area
const SURFACE_FACTORS = [
    { maxSurface: 200, factor: 0.18 },
    { maxSurface: 500, factor: 0.08 },
    { maxSurface: 3000, factor: 0.02 },
    { maxSurface: Infinity, factor: 0 }
];

// Dimension thresholds
const CIRCUMFERENCE_THRESHOLD_LARGE = 1.35;
const CIRCUMFERENCE_THRESHOLD_SMALL = 0.50;
const WIDTH_HEIGHT_THRESHOLD = 0.9;
const LENGTH_THRESHOLD_1 = 0.999;
const LENGTH_THRESHOLD_2 = 1.249;
const LENGTH_THRESHOLD_3 = 1.499;

// Content thresholds
const CONTENT_THRESHOLD_1 = 0.099;
const CONTENT_THRESHOLD_2 = 0.249;
const CONTENT_THRESHOLD_3 = 0.499;

// Quantity thresholds
const QUANTITY_THRESHOLD_1 = 51;
const QUANTITY_THRESHOLD_2 = 251;

function calcformCalculate() {
    const calcForm = document.getElementById('wbc-calcform');

    var Mat = document.getElementById('field-box-kwaliteit');
    var Col = document.getElementById('field-box-kleur');
    const length = parseLocaleFloat(document.getElementById('field-box-lengte').value);
    const width = parseLocaleFloat(document.getElementById('field-box-breedte').value);
    const height = parseLocaleFloat(document.getElementById('field-box-hoogte').value);
    const quantity = Number.parseInt(document.getElementById('field-box-aantal').value, 10);
    const material = parseLocaleFloat(document.getElementById('field-box-kwaliteit').value);
    const materialText = Mat.options[Mat.selectedIndex].text;
    const color = document.getElementById('field-box-kleur').value;
    const colorText = Col.options[Col.selectedIndex].text;

    const factor = Number((LOCAL_FACTOR * GLOBAL_FACTOR).toFixed(5));

    clearAlert();

    if (!length || !width || !height || !quantity || !material || !color) {
        document.getElementById('wbc-prices').style.display = 'none';
        return;
    }

    if (!(validateNumber(length) && validateNumber(width) && validateNumber(height) && validateNumber(quantity))) {
        AlertMSG('Please enter valid numbers for all dimensions and quantity.');
        return;
    }
    if (quantity < 1 || quantity >= 1001) {
        AlertMSG('The price for less than 1 or 1000 or more boxes cannot be calculated online. Please request a quote.');
        return;
    }
    if (length + (2 * height) + 25 > 1790) {
        AlertMSG('Format too large, please request a quote.');
        return;
    }
    if ((length + height + height < 600) && (quantity > 249)) {
        AlertMSG('Please request a quote.');
        return;
    }
    if ((height + height + height + width + width < 700) && (quantity > 249)) {
        AlertMSG('Please request a quote.');
        return;
    }

    const dimensions = {
        length: mmToM(length),
        width: mmToM(width),
        height: mmToM(height),
    };
    const surface = getSurface(dimensions);
    const factors = {
        global: normalizeGlobalFactor(factor),
        material: material,
        surface: getSurfaceFactor(surface, quantity),
    };

    if (factors.material == null) {
        AlertMSG('Invalid material selection.');
        return;
    }

    const surpluses = {
        circumference: getCircumferenceSurplus(dimensions, quantity),
        color: getColorSurplus(color, surface),
        content: getContentSurplus(dimensions, quantity),
        height: getHeightSurplus(dimensions, quantity),
        length: getLengthSurplus(dimensions),
    };
    const modifiers = {
        quantum: getQuantumModifier(quantity),
    };
    const basePrice = getBasePrice(surface, factors);
    const unitPriceExclVat = getUnitPriceExclVat(basePrice, quantity, surpluses, factors, modifiers);
    const unitPriceInclVat = getUnitPriceInclVat(unitPriceExclVat);
    const totalPriceExclVat = getTotalPrice(unitPriceExclVat, quantity);
    const totalPriceInclVat = getTotalPrice(unitPriceInclVat, quantity);

    if (unitPriceExclVat && totalPriceExclVat) {
        const unitPrice = unitPriceExclVat.toFixed(2);
        const totalPrice = totalPriceExclVat.toFixed(2);
        document.getElementById('wbc-detail-quality').textContent = materialText;
        document.getElementById('wbc-detail-color').textContent = colorText;
        document.getElementById('wbc-price-length').textContent = length;
        document.getElementById('wbc-price-width').textContent = width;
        document.getElementById('wbc-price-height').textContent = height;
        document.getElementById('wbc-price-qty').textContent = quantity;
        document.getElementById('wbc-price-unit').textContent = unitPrice.replace('.', ',');
        document.getElementById('wbc-price-total').textContent = totalPrice.replace('.', ',');
        document.getElementById('wbc-prices').style.display = 'block';

        // Fill hidden fields
        document.getElementById('unit-price').value = unitPrice;
        document.getElementById('total-price').value = totalPrice;
        document.getElementById('quantity').value = quantity;
        document.getElementById('dimensions').value = `${length} x ${width} x ${height} mm`;
        document.getElementById('quality').value = materialText;
        document.getElementById('color').value = colorText;
    } else {
        document.getElementById('wbc-prices').style.display = 'none';
    }
}

function getBasePrice(surface, factors) {
    return surface * (factors.material + factors.surface);
}

function getCircumferenceSurplus(dimensions, quantity) {
    const circumference = 2 * (dimensions.length + dimensions.width);

    if (circumference > CIRCUMFERENCE_THRESHOLD_LARGE) {
        return 10 / quantity;
    } else if (circumference < CIRCUMFERENCE_THRESHOLD_SMALL) {
        return 0.10;
    }
    return 0;
}

function getColorSurplus(color, surface) {
    return color === '' ? 0.0000001 : parseFloat(color) * surface;
}

function getContentSurplus(dimensions, quantity) {
    const contents = dimensions.length * dimensions.width * dimensions.height;
    let surplus = 0;

    if (contents > CONTENT_THRESHOLD_1) surplus += 0.05;
    if (contents > CONTENT_THRESHOLD_2) surplus += 0.10;
    if (contents > CONTENT_THRESHOLD_3) surplus += 0.45;
    
    return surplus;
}

function getHeightSurplus(dimensions, quantity) {
    return (dimensions.width + dimensions.height) > WIDTH_HEIGHT_THRESHOLD ? 10 / quantity : 0;
}

function getLengthSurplus(dimensions) {
    let surplus = 0;

    if (dimensions.length > LENGTH_THRESHOLD_1) surplus += 0.25;
    if (dimensions.length > LENGTH_THRESHOLD_2) surplus += 0.35;
    if (dimensions.length > LENGTH_THRESHOLD_3) surplus += 0.50;
    
    return surplus;
}

function getQuantumModifier(quantity) {
    let modifier = 0;
    if (quantity > 999) modifier -= 0.02;
    if (quantity > 749) modifier -= 0.02;
    if (quantity > 499) modifier -= 0.05;
    if (quantity > 249) modifier -= 0.0;
    if (quantity < 100) modifier += 0.02;
    if (quantity < 200) modifier += 0.02;
    if (quantity < 300) modifier += 0.02;
    return modifier;
}

function getSurface(dimensions) {
    return ((dimensions.height + dimensions.height + dimensions.height + dimensions.width + dimensions.width)) * (dimensions.length + dimensions.height + dimensions.height);
}

function getSurfaceFactor(surface, quantity) {
    const totalSurface = surface * quantity;
    for (let factor of SURFACE_FACTORS) {
        if (totalSurface < factor.maxSurface) {
            return factor.factor;
        }
    }
    return 0;
}

function getTotalPrice(unitPrice, quantity) {
    return Number.parseFloat(unitPrice.toFixed(2)) * quantity;
}

function getUnitPriceExclVat(basePrice, quantity, surpluses, factors, modifiers) {
    const combinedSurpluses = Object.keys(surpluses).reduce((total, key) => total += surpluses[key], 0);
    const baseSurcharge = BASE_SURCHARGE + (QUANTITY_SURCHARGE / quantity);
    const profitMargin = quantity < QUANTITY_THRESHOLD_2 ? PROFIT_MARGIN_SMALL : PROFIT_MARGIN_LARGE;

    return ((((basePrice + (baseSurcharge + combinedSurpluses) + modifiers.quantum) * factors.global)) * ADDITIONAL_FACTOR) / profitMargin;
}

function getUnitPriceInclVat(unitPriceExclVat) {
    return unitPriceExclVat * (1 + (VAT_RATE / 100));
}

function mmToM(value) {
    return value / 1000;
}

function normalizeGlobalFactor(factor) {
    return validateNumber(factor) ? factor : 1;
}

function parseLocaleFloat(numeric, stripDelimiters = []) {
    if (typeof numeric !== 'string') return numeric;
    stripDelimiters.forEach(delimiter => numeric = numeric.replace(new RegExp(`[${delimiter}]`, 'g'), ''));
    return Number.parseFloat(numeric.replace(/,/g, '.'));
}

function validateNumber(number) {
    return !Number.isNaN(number) && number > 0;
}

function AlertMSG(Message) {
    clearAlert();
    let form = document.getElementById('wbc-calcform');
    let div = document.createElement('div');
    div.classList.add('alert');
    let text = document.createTextNode(Message);
    div.appendChild(text);
    form.prepend(div);
}

function clearAlert() {
    const el = document.querySelector('.alert');
    if (el) {
        el.remove();
    }
}

function checkAllFieldsFilled() {
    const inputs = document.querySelectorAll('.wbc-calc-field');
    const formInputs = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');
    return Array.from(inputs).every(input => input.value.trim() !== '') &&
           Array.from(formInputs).every(input => input.value.trim() !== '');
}

function updateWarningAndButton() {
    const submitButton = document.getElementById('submit-request');
    const warningMessage = document.getElementById('warning-message');
    const allFilled = checkAllFieldsFilled();
    
    submitButton.disabled = !allFilled;
    warningMessage.style.display = allFilled ? 'none' : 'block';
}

// Attach event listeners to form fields
document.addEventListener('DOMContentLoaded', function() {
    const calcFields = document.querySelectorAll('.wbc-calc-field');
    const formFields = document.querySelectorAll('input[type="text"], input[type="tel"], input[type="email"]');

    calcFields.forEach(field => {
        field.addEventListener('input', () => {
            calcformCalculate();
            updateWarningAndButton();
        });
    });

    formFields.forEach(field => {
        field.addEventListener('input', updateWarningAndButton);
    });

    document.getElementById('submit-request').addEventListener('click', function(event) {
        event.preventDefault();
        document.getElementById('submit-request').style.display = 'none';
        document.getElementById('loading-indicator').style.display = 'block';
        document.querySelector('form').submit();
    });

    // Initial calculation and warning/button state update
    calcformCalculate();
    updateWarningAndButton();
});