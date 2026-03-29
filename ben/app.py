
from flask import *

app = Flask(__name__)

# Here are important variables for general web pages.
# I'm defining them here so that if the file name changes, the path name can also be easily updated.

login_path = "admin/login_ui.html"
customer_path = "customer/customer_ui.html"

# Bring up the login page when the index is accessed.
@app.route("/")
def login():
    return render_template(login_path)


# Return the Customer UI when /customer is accessed.
@app.route("/customer")
def customer():

    return render_template(customer_path)

if __name__ == "__main__":
    app.run( debug = True )