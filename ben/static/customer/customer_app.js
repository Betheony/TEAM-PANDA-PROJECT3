/* 
*
*   This is the app to control the customer interface...
*   This needs a better description :(
*/

// This needs to be an array of string IDs that contains what the customer has in their "cart".
// Anything in this array will be sent to the database to order.
// An array is used to make it easy to display all the items.
// When the array is sent to the DB, the entries need to be converted to strings.

let customer_cart = []

// This struct matches Menu Item names to IDs.
// Used for displaying cart items.
let menu_id_to_name_struct = {

    "101": "Ancestral Samurai Sakura Tea",
    "102": "Iced Yurei Matcha",
    "103": "Patriotic Cold Brew",
    "104": "Bethany's Ballistic Boba Bash",
    "105": "Dr. Taele's Signature Smoothie",
    "106": "Anaya's Dubious Dubai Chocolate Milkshake"
};

// This struct matches Menu Item prices to IDs.
// Used for displaying the total cost.
let menu_id_to_price_struct = {

    "101": 10.99,
    "102": 20.99,
    "103": 30.99,
    "104": 40.99,
    "105": 9876543.210,
    "106": 222.22
};

// This is a function that adds an item to a cart.
function add_item_to_cart(_item) {

    customer_cart.push(parseInt(_item));
    update_cart();
}

// This function deletes everything in the cart array and then displays the now empty cart.
function clear_cart() {

    for (var i = 0; i < customer_cart.length; i++) {

        delete customer_cart[i];
    }

    customer_cart = []
    customer_cart.length = 0;

    update_cart();
}

// Sums the total price of everything in the cart so that the customer knows how much they'll have to pay.
function calculate_total_price() {

    var _price = 0;

    for (var i = 0; i < customer_cart.length; i++) {

        _price += menu_id_to_price_struct[customer_cart.at(i)];
    }

    return "Total Price: $" + _price;
}

// Function to update the cart contents, which are shown on-screen.
// TODO: Make it so that group counts are displayed, not individual items.
// Ex. Have "2x Cold Brew" instead of 2 separate "Cold Brew" listings.
function compute_cart_contents() {

    var _innerHTMLstring = "";
    for (var _i = 0; _i < customer_cart.length; _i++) {

        _innerHTMLstring = _innerHTMLstring + "<p>" + menu_id_to_name_struct[customer_cart.at(_i)] + "</p>";
    }

    return _innerHTMLstring;
}

function update_cart() {

    document.getElementById("total_price").innerHTML = calculate_total_price();
    document.getElementById("cart_items").innerHTML = compute_cart_contents();
}