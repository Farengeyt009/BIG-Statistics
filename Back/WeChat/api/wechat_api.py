from flask import Blueprint, request, jsonify
from functools import wraps
import jwt
from Back.WeChat.service.wechat_service import WeChatService

wechat_bp = Blueprint('wechat', __name__, url_prefix='/api/wechat')
wechat_service = WeChatService()

def token_required(f):
    """Декоратор для проверки JWT токена"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'success': False, 'message': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, 'your-secret-key-change-in-production', algorithms=['HS256'])
            current_user_id = data['user_id']
        except:
            return jsonify({'success': False, 'message': 'Token is invalid'}), 401
        
        return f(current_user_id, *args, **kwargs)
    return decorated

@wechat_bp.route('/generate-qr', methods=['POST'])
@token_required
def generate_qr(current_user_id):
    """Генерация QR-кода для привязки WeChat"""
    try:
        qr_session = wechat_service.generate_qr_session(current_user_id)
        if not qr_session:
            return jsonify({
                'success': False,
                'message': 'Failed to generate QR session'
            }), 500
        
        return jsonify({
            'success': True,
            'data': {
                'session_id': qr_session.session_id,
                'qr_code_data': qr_session.qr_code_data,
                'expires_at': qr_session.expires_at.isoformat() if qr_session.expires_at else None
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error generating QR: {str(e)}'
        }), 500

@wechat_bp.route('/status/<session_id>', methods=['GET'])
@token_required
def get_qr_status(current_user_id, session_id):
    """Проверка статуса QR-сессии"""
    try:
        qr_session = wechat_service.get_qr_session_status(session_id)
        if not qr_session:
            return jsonify({
                'success': False,
                'message': 'QR session not found'
            }), 404
        
        return jsonify({
            'success': True,
            'data': qr_session.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting QR status: {str(e)}'
        }), 500

@wechat_bp.route('/bind', methods=['POST'])
@token_required
def bind_wechat(current_user_id):
    """Привязка WeChat аккаунта"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        # В реальной реализации здесь будет получение данных от WeChat API
        # Пока используем тестовые данные
        wechat_data = {
            'openid': data.get('openid'),
            'unionid': data.get('unionid'),
            'nickname': data.get('nickname'),
            'headimgurl': data.get('headimgurl')
        }
        
        binding = wechat_service.bind_wechat_account(current_user_id, wechat_data)
        if not binding:
            return jsonify({
                'success': False,
                'message': 'Failed to bind WeChat account'
            }), 500
        
        return jsonify({
            'success': True,
            'data': binding.to_dict()
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error binding WeChat: {str(e)}'
        }), 500

@wechat_bp.route('/unbind', methods=['DELETE'])
@token_required
def unbind_wechat(current_user_id):
    """Отвязка WeChat аккаунта"""
    try:
        success = wechat_service.unbind_wechat_account(current_user_id)
        if not success:
            return jsonify({
                'success': False,
                'message': 'No WeChat account bound to this user'
            }), 404
        
        return jsonify({
            'success': True,
            'message': 'WeChat account unbound successfully'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error unbinding WeChat: {str(e)}'
        }), 500

@wechat_bp.route('/binding', methods=['GET'])
@token_required
def get_wechat_binding(current_user_id):
    """Получение информации о привязке WeChat"""
    try:
        binding = wechat_service.get_user_wechat_binding(current_user_id)
        if not binding:
            return jsonify({
                'success': True,
                'data': None,
                'message': 'No WeChat account bound'
            })
        
        return jsonify({
            'success': True,
            'data': binding.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error getting WeChat binding: {str(e)}'
        }), 500

@wechat_bp.route('/callback', methods=['GET'])
def wechat_callback():
    """Callback endpoint для WeChat OAuth"""
    try:
        code = request.args.get('code')
        state = request.args.get('state')
        
        if not code:
            return jsonify({
                'success': False,
                'message': 'Authorization code not provided'
            }), 400
        
        # Здесь будет логика обмена code на access_token
        # и получения данных пользователя WeChat
        return jsonify({
            'success': True,
            'message': 'WeChat callback received',
            'data': {
                'code': code,
                'state': state
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error in WeChat callback: {str(e)}'
        }), 500

