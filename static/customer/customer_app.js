/* 
*
*   This is the app to control the customer interface...
*   This needs a better description :(
*/

// This needs to be an array of integer order IDs that contains what the customer has in their "cart".
// Anything in this array will be sent to the database to order.
// An array is used to make it easy to display all the items.

let customer_items = []

function add_item_to_cart( _item ) {

    try {

        customer_items.push( parseInt( _item ) );

        console.log(_item);
        console.log(customer_items);

        var _innerHTMLstring = "";
        for( var _i = 0; _i < customer_items.length; _i++ ) {

            _innerHTMLstring = _innerHTMLstring + "<p>" + customer_items.at(_i) + "</p>";
        }

        document.getElementById("cart_items").innerHTML = _innerHTMLstring;
    }
    catch( _error ) {

        console.log(_error)
        return;
    }
}