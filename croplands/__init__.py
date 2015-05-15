from flask import Flask, render_template, make_response, Response, redirect, request
from functools import wraps
import requests
from urlparse import urlparse, urlunparse


def cache(seconds=0):
    def wrapper(fn):
        @wraps(fn)
        def view(*args, **kwargs):
            resp = make_response(fn(*args, **kwargs))
            if seconds == 0:
                resp.cache_control.no_cache = True
            else:
                resp.cache_control.max_age = seconds
            return resp

        return view

    return wrapper


app = Flask(__name__)
app.config['VERSION'] = '2.0.10'

@app.route('/')
@cache(300)
def index(*args, **kwargs):
    return render_template('home.html', version=app.config['VERSION'])


@app.route('/app/<path:path>')
@cache(0)
def angular_app(path=None):
    return render_template('app.html', version=app.config['VERSION'])


@app.route('/s3/<path:path>')
@cache(1800)
def s3_proxy(path=None):
    """ This view acts as a proxy to s3.
    :param path: str
    :return: Response
    """
    def generate():
        r = requests.get('https://s3.amazonaws.com/gfsad30/' + path, stream=True)
        for chunk in r.raw.read(1024 * 1024):
            yield chunk

    return Response(response=generate(), content_type='application/javascript',
                    headers={'content-encoding': 'gzip'})

@app.route('/mobile')
def mobile():
    return render_template('mobile.html', version=app.config['VERSION'])

@app.errorhandler(404)
@cache(0)
def not_found(e):
    return render_template('404.html', version=app.config['VERSION']), 404

@app.before_request
def redirect_non_www():
    """Redirect non-www requests to www."""
    url_parts = urlparse(request.url)
    print url_parts
    if url_parts.netloc == 'croplands.org':
        url_parts_list = list(url_parts)
        url_parts_list[1] = 'www.croplands.org'
        return redirect(urlunparse(url_parts_list), code=301)

if __name__ == '__main__':
    app.run(debug=True)