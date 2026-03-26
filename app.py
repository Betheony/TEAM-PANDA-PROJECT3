
from flask import *

app = Flask(__name__)

# Here are important variables for general web pages.
# I'm defining them here so that if the file name changes, the path name can also be easily updated.

login_path = "admin/login_ui.html"
customer_path = "customer/customer_ui.html"


@app.route("/")
def index():
    return render_template(login_path)


@app.route("/customer")
def customer():

    return render_template(customer_path)

if __name__ == "__main__":
    app.run( debug = True )